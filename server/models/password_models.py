from pydantic import BaseModel

class PasswordChangeFromClient(BaseModel):
    new_password: str
