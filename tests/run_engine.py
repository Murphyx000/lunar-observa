"""Pure JS tests using the installed JavaScriptCore library (no Node required)."""
from pathlib import Path
import ctypes as C
import ctypes.util
import json
root = Path(__file__).resolve().parents[1]
lib = C.CDLL(ctypes.util.find_library('javascriptcoregtk-4.1'))
ptr = C.c_void_p
lib.JSGlobalContextCreate.argtypes=[ptr]; lib.JSGlobalContextCreate.restype=ptr
lib.JSStringCreateWithUTF8CString.argtypes=[C.c_char_p]; lib.JSStringCreateWithUTF8CString.restype=ptr
lib.JSEvaluateScript.argtypes=[ptr,ptr,ptr,ptr,C.c_int,C.POINTER(ptr)]; lib.JSEvaluateScript.restype=ptr
lib.JSValueToStringCopy.argtypes=[ptr,ptr,C.POINTER(ptr)]; lib.JSValueToStringCopy.restype=ptr
lib.JSStringGetMaximumUTF8CStringSize.argtypes=[ptr]; lib.JSStringGetMaximumUTF8CStringSize.restype=C.c_size_t
lib.JSStringGetUTF8CString.argtypes=[ptr,C.c_char_p,C.c_size_t]; lib.JSStringGetUTF8CString.restype=C.c_size_t
lib.JSCheckScriptSyntax.argtypes=[ptr,ptr,ptr,C.c_int,C.POINTER(ptr)]; lib.JSCheckScriptSyntax.restype=C.c_bool
ctx=lib.JSGlobalContextCreate(None)
def text(value):
    string=lib.JSValueToStringCopy(ctx,value,None)
    size=lib.JSStringGetMaximumUTF8CStringSize(string); buf=C.create_string_buffer(size)
    lib.JSStringGetUTF8CString(string,buf,size); return buf.value.decode()
engine=(root/'engine.js').read_text().replace('export ','')
script='JSON.stringify((()=>{'+engine+(root/'tests/engine-tests.js').read_text()+'})())'
exc=ptr(); value=lib.JSEvaluateScript(ctx,lib.JSStringCreateWithUTF8CString(script.encode()),None,None,1,C.byref(exc))
if exc.value: raise RuntimeError(text(exc))
results=json.loads(text(value))
for name in ['engine.js','app.js']:
    source=(root/name).read_text().replace('export ','')
    if name=='app.js': source='\n'.join(source.splitlines()[1:])
    exc=ptr()
    ok=lib.JSCheckScriptSyntax(ctx,lib.JSStringCreateWithUTF8CString(source.encode()),None,1,C.byref(exc))
    results.append({'name':name+' syntax','ok':bool(ok),**({'error':text(exc)} if exc.value else {})})
print(json.dumps(results,indent=2,ensure_ascii=False))
assert all(r['ok'] for r in results)
