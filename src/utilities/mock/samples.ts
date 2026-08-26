export const SAMPLE_JSON_SCHEMA = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Customer",
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "fullName": { "type": "string" },
    "email": { "type": "string", "format": "email" },
    "phone": { "type": "string" },
    "company": { "type": "string" },
    "status": { "enum": ["active", "pending", "suspended"] },
    "balance": { "type": "number", "minimum": 0, "maximum": 5000, "multipleOf": 0.01 },
    "cardNumber": { "type": "string" },
    "reference": { "type": "string", "pattern": "^[A-Z]{3}-[0-9]{6}$" },
    "createdAt": { "type": "string", "format": "date-time" },
    "address": { "$ref": "#/$defs/Address" },
    "tags": { "type": "array", "items": { "type": "string" }, "maxItems": 4 }
  },
  "required": ["id", "fullName", "email", "status", "balance", "createdAt", "address"],
  "$defs": {
    "Address": {
      "type": "object",
      "properties": {
        "street": { "type": "string" },
        "city": { "type": "string" },
        "postcode": { "type": "string" },
        "countryCode": { "type": "string" }
      },
      "required": ["street", "city", "postcode", "countryCode"]
    }
  }
}
`;

export const SAMPLE_ZOD = `import { z } from "zod";

export const Address = z.object({
  street: z.string(),
  city: z.string(),
  postcode: z.string(),
  countryCode: z.string(),
});

export const Customer = z.object({
  id: z.uuid(),
  fullName: z.string(),
  email: z.email(),
  phone: z.string().optional(),
  company: z.string().optional(),
  status: z.enum(["active", "pending", "suspended"]),
  balance: z.number().min(0).max(5000).multipleOf(0.01),
  cardNumber: z.string().optional(),
  reference: z.string().regex(/^[A-Z]{3}-[0-9]{6}$/).optional(),
  createdAt: z.iso.datetime(),
  address: Address,
  tags: z.array(z.string()).max(4).optional(),
});
`;

export const SAMPLE_PYDANTIC = `from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class Address(BaseModel):
    street: str
    city: str
    postcode: str
    country_code: str


class Customer(BaseModel):
    id: UUID
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    status: Literal["active", "pending", "suspended"]
    balance: float = Field(..., ge=0, le=5000, multiple_of=0.01)
    card_number: Optional[str] = None
    reference: Optional[str] = Field(None, pattern="^[A-Z]{3}-[0-9]{6}$")
    created_at: datetime
    address: Address
    tags: Optional[list[str]] = Field(None, max_length=4)
`;
