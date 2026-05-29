with open(r'c:\Users\lishi\webify\Webify\app\page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find ALL remaining "} catch {" duplicates that follow a "} catch {}"
to_delete = []
i = 0
while i < len(lines):
    if lines[i].strip() == '} catch {}':
        # Check if next non-empty line starts another catch
        j = i + 1
        while j < len(lines) and lines[j].strip() == '':
            j += 1
        if j < len(lines) and lines[j].strip().startswith('} catch {'):
            # Find end of this duplicate catch block
            end = j + 1
            if lines[j].strip() == '} catch {':
                # Multi-line - find closing }
                while end < len(lines):
                    if lines[end].strip() == '}':
                        end += 1
                        break
                    end += 1
            # Mark lines i+1 to end for deletion (keep the first } catch {})
            for k in range(i+1, end):
                to_delete.append(k)
            print(f"Found duplicate catch at lines {i+2}-{end} (1-indexed)")
    i += 1

# Delete in reverse order
for idx in sorted(to_delete, reverse=True):
    del lines[idx]

with open(r'c:\Users\lishi\webify\Webify\app\page.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"Deleted {len(to_delete)} lines")
