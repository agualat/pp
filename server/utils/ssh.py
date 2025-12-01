"""SSH key management utilities for server authentication."""
import os
import subprocess
from pathlib import Path


def generate_ssh_keypair(server_name: str, ssh_keys_dir: str = "/app/ssh_keys") -> tuple[str, str]:
    """
    Generate SSH key pair for a server using ssh-keygen.
    
    Args:
        server_name: Name of the server (used for key filename)
        ssh_keys_dir: Directory to store SSH keys
        
    Returns:
        tuple: (private_key_path, public_key_content)
    """
    # Create ssh_keys directory if it doesn't exist
    keys_path = Path(ssh_keys_dir)
    keys_path.mkdir(exist_ok=True, parents=True)
    
    # Generate key paths
    private_key_path = keys_path / f"{server_name}_id_rsa"
    public_key_path = keys_path / f"{server_name}_id_rsa.pub"
    
    # Check if key already exists
    if private_key_path.exists():
        print(f"SSH key for {server_name} already exists, using existing key")
        with open(public_key_path, 'r') as f:
            public_key_content = f.read().strip()
        return f"ssh_keys/{server_name}_id_rsa", public_key_content
    
    # Generate RSA key pair using ssh-keygen (4096 bits)
    try:
        subprocess.run([
            "ssh-keygen",
            "-t", "rsa",
            "-b", "4096",
            "-f", str(private_key_path),
            "-N", "",  # No passphrase
            "-C", f"ansible@{server_name}"
        ], check=True, capture_output=True)
        
        # Set proper permissions
        os.chmod(private_key_path, 0o600)
        os.chmod(public_key_path, 0o644)
        
        # Read public key content
        with open(public_key_path, 'r') as f:
            public_key_content = f.read().strip()
        
        print(f"SSH key generated successfully for {server_name}")
        return f"ssh_keys/{server_name}_id_rsa", public_key_content
        
    except subprocess.CalledProcessError as e:
        print(f"Error generating SSH key: {e}")
        raise
    except Exception as e:
        print(f"Unexpected error generating SSH key: {e}")
        raise

def deploy_ssh_key(host: str, username: str, password: str, public_key: str, port: int = 22) -> bool:
    """
    Deploy SSH public key to remote server.
    
    Args:
        host: Server IP address or hostname
        username: SSH username
        password: SSH password
        public_key: Public key content to deploy
        port: SSH port (default 22)
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        import paramiko
        
        # Connect to server
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(host, port=port, username=username, password=password, timeout=10)
        
        # Create .ssh directory if it doesn't exist
        ssh.exec_command("mkdir -p ~/.ssh && chmod 700 ~/.ssh")
        
        # Check if key already exists in authorized_keys
        stdin, stdout, stderr = ssh.exec_command("cat ~/.ssh/authorized_keys 2>/dev/null")
        existing_keys = stdout.read().decode('utf-8')
        
        # Only add if key doesn't already exist
        if public_key not in existing_keys:
            # Append public key to authorized_keys
            command = f'echo "{public_key}" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'
            stdin, stdout, stderr = ssh.exec_command(command)
            
            # Check if command was successful
            exit_status = stdout.channel.recv_exit_status()
            
            if exit_status == 0:
                print(f"SSH key deployed successfully to {username}@{host}")
            else:
                print(f"Failed to deploy SSH key to {username}@{host}: {stderr.read().decode('utf-8')}")
                ssh.close()
                return False
        else:
            print(f"SSH key already exists in authorized_keys for {username}@{host}")
        
        ssh.close()
        return True
        
    except Exception as e:
        print(f"Error deploying SSH key to {username}@{host}: {e}")
        return False
