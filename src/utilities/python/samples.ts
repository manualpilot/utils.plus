export const SAMPLE_SCRIPT = `import sys
from datetime import datetime, timezone

print(f"Python {sys.version.split()[0]}")
print(datetime.now(timezone.utc).isoformat(timespec="seconds"))
`;
