import uuid

from pydantic import BaseModel


class ManagerOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str

    model_config = {"from_attributes": True}