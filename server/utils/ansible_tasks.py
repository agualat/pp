import ansible_runner
import tempfile
import json
from typing import List
from .celery_config import celery_app
from .db import SessionLocal
from ..CRUD.ansible import get_task_by_id
from ..CRUD.servers import get_server_by_id
from ..CRUD.executed_playbooks import get_execution_by_id, update_execution_state
from ..models.models import ExecutionState


@celery_app.task(bind=True)
def run_ansible_playbook(self, execution_id: int):
    """
    Tarea de Celery que ejecuta un playbook de Ansible.
    Actualiza el estado de la ejecución en la base de datos.
    """
    db = SessionLocal()
    
    try:
        # Obtener la ejecución
        execution = get_execution_by_id(db, execution_id)
        if not execution:
            return {"error": "Execution not found"}
        
        # Obtener el playbook
        playbook_task = get_task_by_id(db, execution.playbook_id)
        if not playbook_task:
            update_execution_state(db, execution_id, ExecutionState.error)
            return {"error": "Playbook not found"}
        
        # Obtener servidores
        servers = []
        for server_id in execution.servers:
            server = get_server_by_id(db, server_id)
            if server:
                servers.append(server)
        
        if not servers:
            update_execution_state(db, execution_id, ExecutionState.error)
            return {"error": "No valid servers found"}
        
        # Crear inventario dinámico
        inventory = {
            "all": {
                "hosts": {
                    server.name: {
                        "ansible_host": server.ip_address,
                        "ansible_user": server.ssh_user,
                        "ansible_ssh_private_key_file": server.ssh_private_key_path,
                    }
                    for server in servers
                }
            }
        }
        
        # Crear archivo temporal para el inventario
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as inv_file:
            json.dump(inventory, inv_file)
            inventory_path = inv_file.name
        
        # Ejecutar el playbook con ansible-runner
        runner_result = ansible_runner.run(
            playbook=playbook_task.playbook,
            inventory=inventory_path,
            quiet=False,
            verbosity=1,
        )
        
        # Determinar el estado final
        if runner_result.status == "successful":
            final_state = ExecutionState.success
        else:
            final_state = ExecutionState.error
        
        # Actualizar estado en DB
        update_execution_state(db, execution_id, final_state)
        
        return {
            "execution_id": execution_id,
            "status": runner_result.status,
            "rc": runner_result.rc,
        }
        
    except Exception as e:
        # En caso de error, marcar la ejecución como error
        update_execution_state(db, execution_id, ExecutionState.error)
        return {"error": str(e), "execution_id": execution_id}
    
    finally:
        db.close()
