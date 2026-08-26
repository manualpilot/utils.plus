import type { FormatId } from "./formats";

export const SAMPLES: { [id in FormatId]: string } = {
  yaml: `name: utils-plus
port: 8080
debug: false
database:
  host: localhost
  port: 5432
  replicas:
    - eu-west-1
    - us-east-1
features:
  search: true
  upload: false
`,
  json: `{
  "name": "utils-plus",
  "port": 8080,
  "debug": false,
  "database": {
    "host": "localhost",
    "port": 5432,
    "replicas": [
      "eu-west-1",
      "us-east-1"
    ]
  },
  "features": {
    "search": true,
    "upload": false
  }
}
`,
  toml: `name = "utils-plus"
port = 8080
debug = false

[database]
host = "localhost"
port = 5432
replicas = [ "eu-west-1", "us-east-1" ]

[features]
search = true
upload = false
`,
  env: `name=utils-plus
port=8080
debug=false
database__host=localhost
database__port=5432
database__replicas__0=eu-west-1
database__replicas__1=us-east-1
features__search=true
features__upload=false
`,
  properties: `name=utils-plus
port=8080
debug=false
database.host=localhost
database.port=5432
database.replicas.0=eu-west-1
database.replicas.1=us-east-1
features.search=true
features.upload=false
`,
};
