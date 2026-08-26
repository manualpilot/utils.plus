import type { Schema } from "../../common/schema/ir";
import { type Field, type FieldId, fieldNamed, FIELDS } from "./fields";

export function detectField(name: string, schema: Schema): Field {
  const declared = schema.kind === "string" && schema.format ? FORMAT_FIELDS[schema.format] : undefined;
  const chosen = declared ?? fieldForName(name) ?? fallbackFor(schema);
  const field = fieldNamed(chosen);
  return field ?? FIELDS.word;
}

export function fieldForName(name: string): FieldId | undefined {
  const words = normalise(name);
  return NAME_PATTERNS.find(([pattern]) => pattern.test(words))?.[1];
}

export function normalise(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function fallbackFor(schema: Schema): FieldId {
  switch (schema.kind) {
    case "boolean":
      return "boolean";
    case "number":
      return schema.integer ? "integer" : "decimal";
    default:
      return "sentence";
  }
}

const FORMAT_FIELDS: Record<string, FieldId> = {
  "date-time": "dateTime",
  date: "date",
  time: "time",
  duration: "duration",
  email: "email",
  hostname: "hostname",
  ipv4: "ipv4",
  ipv6: "ipv6",
  uri: "url",
  "uri-reference": "url",
  uuid: "uuid",
};

const NAME_PATTERNS: [RegExp, FieldId][] = [
  [/\b(first|given|fore)\s?name\b|^given$/, "firstName"],
  [/\b(last|sur|family)\s?name\b|^surname$/, "lastName"],
  [/\bmiddle\s?name\b/, "firstName"],
  [/\b(full|display|contact|customer|person|author|owner)\s?name\b|^name$/, "fullName"],
  [/\b(user|login|screen|nick|account)\s?name\b|^(username|handle|nickname|login)$/, "username"],
  [/\b(e\s?mail|email address)\b|^email$|\bemail\b/, "email"],
  [/\b(phone|mobile|telephone|msisdn|cell)\b|^tel$/, "phone"],
  [/\b(job|employment)\s?title\b|^(role|position|occupation|job)$/, "jobTitle"],
  [/\b(department|division|team)\b/, "department"],
  [/\b(gender|sex)\b/, "gender"],
  [/\b(birth\s?date|date of birth|birthday|dob)\b/, "birthDate"],
  [/^age$|\bage\b/, "age"],

  [/\bavatar\b|\b(profile|image|photo|picture|thumbnail|banner|cover)\s?(url|uri|src|link)?\b/, "imageUrl"],
  [/\b(url|uri|link|website|homepage|href|permalink|endpoint|callback|webhook)\b/, "url"],
  [/\b(host\s?name|domain)\b|^host$/, "hostname"],
  [/\bslug\b/, "slug"],
  [/\b(uuid|guid)\b/, "uuid"],
  [/\b(ipv6)\b/, "ipv6"],
  [/\b(ip|ipv4|ip address|remote addr|client ip)\b/, "ipv4"],
  [/\bmac\s?(address)?\b/, "mac"],
  [/\buser\s?agent\b/, "userAgent"],
  [/\b(http\s?)?method\b|^verb$/, "httpMethod"],
  [/\b(status\s?code|http\s?status|response\s?code)\b/, "httpStatus"],
  [/\b(mime|content|media)\s?type\b/, "mimeType"],
  [/\bfile\s?name\b|^filename$/, "fileName"],
  [/\b(version|semver|release)\b/, "semver"],
  [/\b(token|secret|api key|access key|password|passphrase|signature|nonce|salt)\b/, "token"],
  [/\b(locale|language|lang)\b/, "languageTag"],
  [/\btime\s?zone\b|^tz$/, "timezone"],

  [/\b(street|address\s?(line|1)?|road)\b/, "street"],
  [/\b(city|town|locality|suburb)\b/, "city"],
  [/\b(post(al)?\s?code|zip\s?(code)?)\b/, "postcode"],
  [/\bcountry\s?(code|iso)\b/, "countryCode"],
  [/\bcountry\b/, "country"],
  [/\b(latitude|lat)\b/, "latitude"],
  [/\b(longitude|lng|lon|long)\b/, "longitude"],
  [/\b(state|province|region|county|prefecture)\b/, "region"],

  [/\b(company|organisation|organization|employer|vendor|supplier|merchant|business|manufacturer)\b/, "company"],
  [/\b(product|item|article|sku)\s?(name|title)?\b/, "product"],
  [/\b(price|amount|total|cost|salary|balance|fee|subtotal|revenue)\b/, "price"],
  [/\bcurrency\b/, "currency"],
  [/\b(card\s?number|credit\s?card|pan)\b|^card$/, "creditCard"],
  [/\biban\b/, "iban"],
  [/\b(bic|swift)\b/, "bic"],
  [/\bisbn\b/, "isbn"],
  [/\b(ean|upc|gtin|barcode)\b/, "ean"],
  [/\bcolou?r\b/, "hexColour"],

  [/\b(created|inserted|registered|joined|published|posted)\b/, "pastDateTime"],
  [/\b(expires?|expiry|expiration|due|scheduled|starts?|ends?|renews?)\b/, "futureDateTime"],
  [/\b(updated|modified|deleted|archived|last seen|timestamp)\b/, "dateTime"],
  [/\bepoch\b|\bunix\b/, "epochSeconds"],
  [/\bduration\b/, "duration"],
  [/\bdate\b/, "date"],
  [/\btime\b/, "time"],

  [/\b(tags?|keywords?|categor(y|ies))\b/, "word"],
  [/\bstatus\b|^state$/, "status"],
  [/\b(description|summary|bio|about|notes?|comments?|message|body|content|text|excerpt|remarks)\b/, "paragraph"],
  [/\b(title|subject|headline|label|caption)\b/, "title"],
  [/\b(count|quantity|qty|number|num|total items|index|position|rank|score|weight|height|width|size)\b/, "integer"],
  [/^(is|has|can|should|was|does)\b|\b(active|enabled|disabled|verified|visible|public|archived|deleted)\b/, "boolean"],
  [/\bid\b/, "uuid"],
];
