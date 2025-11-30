"""SSH key management utilities for server authentication."""
import os
import paramiko
from pathlib import Path


def generate_ssh_keypair(server_name: str, ssh_keys_dir: str = "ssh_keys") -> tuple[str, str]:
    """
    Generate SSH key pair for a server.
    
    Args:
        server_name: Name of the server (used for key filename)
        ssh_keys_dir: Directory to store SSH keys
        
    Returns:
        tuple: (private_key_path, public_key_content)
    """
    # Create ssh_keys directory if it doesn't exist
    keys_path = Path(ssh_keys_dir)
    keys_path.mkdir(exist_ok=True)
    
    # Generate key paths
    private_key_path = keys_path / f"{server_name}_id_rsa"
    public_key_path = keys_path / f"{server_name}_id_rsa.pub"
    
    # Generate RSA key pair
    key = paramiko.RSAKey.generate(bits=2048)
    
    # Write private key
    key.write_private_key_file(str(private_key_path))
    
    # Write public key in OpenSSH format
    public_key_content = f"{key.get_name()} {key.get_base64()}"
    with open(public_key_path, 'w') as f:
        f.write(public_key_content)
    
    # Set proper permissions (read-only for owner)
    os.chmod(private_key_path, 0o600)
    os.chmod(public_key_path, 0o644)
    
    return str(private_key_path), public_key_content


def deploy_ssh_key(host: str, username: str, password: str, public_key: str) -> bool:
    """
    Deploy SSH public key to remote server.
    
    Args:
        host: Server IP address or hostname
        username: SSH username
        password: SSH password
        public_key: Public key content to deploy
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Connect to server
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(host, username=username, password=password)
        
        # Create .ssh directory if it doesn't exist
        ssh.exec_command("mkdir -p ~/.ssh && chmod 700 ~/.ssh")
        
        # Append public key to authorized_keys
        command = f'echo "{public_key}" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'
        stdin, stdout, stderr = ssh.exec_command(command)
        
        # Check if command was successful
        exit_status = stdout.channel.recv_exit_status()
        
        ssh.close()
        
        return exit_status == 0
        
    except Exception as e:
        print(f"Error deploying SSH key: {e}")
        return False
