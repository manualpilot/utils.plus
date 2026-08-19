export const SAMPLE_JSON_SCHEMA = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "User",
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "name": { "type": "string", "minLength": 1, "maxLength": 80 },
    "email": { "type": "string", "format": "email" },
    "age": { "type": "integer", "minimum": 0, "maximum": 120 },
    "role": { "enum": ["admin", "editor", "viewer"], "default": "viewer" },
    "tags": { "type": "array", "items": { "type": "string" }, "maxItems": 5 },
    "address": { "$ref": "#/$defs/Address" }
  },
  "required": ["id", "name", "email", "address"],
  "$defs": {
    "Address": {
      "type": "object",
      "properties": {
        "street": { "type": "string", "minLength": 1 },
        "city": { "type": "string", "minLength": 1 },
        "postcode": { "type": "string", "pattern": "^[0-9]{4,6}$" }
      },
      "required": ["street", "city", "postcode"]
    }
  }
}
`;

export const SAMPLE_ZOD = `import { z } from "zod";

export const Address = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  postcode: z.string().regex(/^[0-9]{4,6}$/),
});

export const User = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(80),
  email: z.email(),
  age: z.int().min(0).max(120).optional(),
  role: z.enum(["admin", "editor", "viewer"]).default("viewer"),
  tags: z.array(z.string()).max(5).optional(),
  address: Address,
});
`;

export const SAMPLE_PYDANTIC = `from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class Address(BaseModel):
    street: str = Field(..., min_length=1)
    city: str = Field(..., min_length=1)
    postcode: str = Field(..., pattern="^[0-9]{4,6}$")


class User(BaseModel):
    id: UUID
    name: str = Field(..., min_length=1, max_length=80)
    email: EmailStr
    age: Optional[int] = Field(None, ge=0, le=120)
    role: Literal["admin", "editor", "viewer"] = "viewer"
    tags: Optional[list[str]] = Field(None, max_length=5)
    address: Address
`;

export const SAMPLE_PAYLOAD = `{
  "id": "8f14e45f-ceea-467a-9a3f-2b0c3d4e5f60",
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "age": 36,
  "role": "admin",
  "tags": ["founder", "mathematics"],
  "address": {
    "street": "12 St James's Square",
    "city": "London",
    "postcode": "SW1Y"
  }
}
`;
