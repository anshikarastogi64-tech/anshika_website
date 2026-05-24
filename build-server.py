# Read files
with open("server-clean.js", "r", encoding="utf-8") as f:
    base = f.readlines()

with open("dream-route-complete.js", "r", encoding="utf-8") as f:
    route = f.read()

# Build new server.js
result = []
route_added = False

for line in base:
    # Add nodemailer after multer
    if "const multer = require('multer');" in line:
        result.append(line)
        result.append("const nodemailer = require('nodemailer');\n")
    # Add route before app.listen
    elif line.strip().startswith("app.listen(PORT") and not route_added:
        result.append("\n" + route + "\n\n")
        result.append(line)
        route_added = True
    else:
        result.append(line)

# Write result
with open("server.js", "w", encoding="utf-8") as f:
    f.writelines(result)

print("server.js built successfully with dream contact route")
