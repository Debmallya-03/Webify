with open(r'c:\Users\lishi\webify\Webify\app\page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the problematic area - lines around 1123-1134 (0-indexed: 1122-1133)
# Looking for the pattern: "} catch {}" followed by "} catch {"
i = 0
fixes = 0
while i < len(lines):
    # Find "    } catch {}" followed by empty line and "    } catch {"
    stripped = lines[i].rstrip()
    if stripped == '    } catch {}' and i + 2 < len(lines):
        next_non_empty = i + 1
        while next_non_empty < len(lines) and lines[next_non_empty].strip() == '':
            next_non_empty += 1
        if next_non_empty < len(lines) and '} catch {' in lines[next_non_empty]:
            # Found duplicate - remove from i+1 to end of duplicate catch block
            # Find the closing } of the duplicate catch
            end = next_non_empty + 1
            brace_count = 1 if '{' in lines[next_non_empty] and '}' not in lines[next_non_empty].split('{', 1)[1] else 0
            if lines[next_non_empty].rstrip().endswith('{'):
                # Multi-line catch block
                while end < len(lines) and brace_count > 0:
                    if '{' in lines[end]:
                        brace_count += lines[end].count('{')
                    if '}' in lines[end]:
                        brace_count -= lines[end].count('}')
                    end += 1
            else:
                # Single line like "} catch {\n  }\n"
                end = next_non_empty + 1
                while end < len(lines) and lines[end].strip() != '':
                    if lines[end].strip() == '}':
                        end += 1
                        break
                    end += 1
            
            print(f"Removing duplicate catch at lines {i+2}-{end} (1-indexed)")
            print(f"  Content: {''.join(lines[i+1:end])}")
            # Remove the blank line(s) and duplicate catch block
            del lines[i+1:end]
            fixes += 1
            continue
    i += 1

if fixes > 0:
    with open(r'c:\Users\lishi\webify\Webify\app\page.tsx', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print(f'\nFixed {fixes} duplicate catch blocks')
else:
    print('No fixes needed')
