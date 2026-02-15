import os
path = r'c:\Users\ASUS\Desktop\novel_factory\output\text\제5화.md'
with open(path, 'r', encoding='utf-8') as fh:
    text = fh.read()
    if '[🎬 영상화 메모]' in text:
        body = text.split('[🎬 영상화 메모]')[0]
    else:
        body = text
    chars = len(body.replace(' ','').replace('\n','').replace('#','').replace('-','').replace('*','').replace('>','').replace('|',''))
    print("본문 글자수: " + str(chars))
    print("전체 글자수: " + str(len(text)))
