with open(r'c:\Users\lishi\webify\Webify\app\page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove lines 1123-1125 (0-indexed: 1122-1124) - the duplicate "} catch { }"
# And lines 1132-1135 (0-indexed: 1131-1134) - the duplicate "} catch { // corrupted... }"

# Work backwards to avoid index shifting
# Second duplicate: lines 1133-1135 (1-indexed), 0-indexed 1132-1134
del lines[1132:1135]

# First duplicate: lines 1123-1125 (1-indexed), 0-indexed 1122-1124  
del lines[1122:1125]

with open(r'c:\Users\lishi\webify\Webify\app\page.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Fixed')

# Verify
with open(r'c:\Users\lishi\webify\Webify\app\page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
print('Lines 1115-1135:')
for i in range(1114, 1135):
    print(f'{i+1}: {lines[i]}', end='')
