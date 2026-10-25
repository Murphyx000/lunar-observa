"""Integration tests with synthetic data only. Never clinical validation."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width":1440,"height":1100}, accept_downloads=True)
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    def serve(route):
        url=route.request.url
        if not url.startswith('https://luma.test/'):
            route.abort(); return
        path=url.split('https://luma.test/',1)[1].split('?',1)[0] or 'index.html'
        file=ROOT/path
        if file.is_file() and ROOT in file.resolve().parents:
            kind={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}.get(file.suffix,'text/plain')
            route.fulfill(body=file.read_bytes(),content_type=kind)
        else: route.abort()
    page.route('**/*',serve)
    page.goto('https://luma.test/')
    assert page.title()=='Luma · Observa tu piel'
    assert page.locator('#analyze').is_disabled()
    assert page.locator('#report').is_disabled()
    page.locator('#demo').click()
    assert 'SINTÉTICO' in page.locator('#image-label').inner_text()
    page.locator('#segment').click()
    page.wait_for_function("!document.getElementById('confirm').disabled")
    assert page.locator('#analyze').is_disabled()
    page.locator('#confirm').check()
    page.locator('#analyze').click()
    assert page.locator('#report').is_enabled()
    assert '%' in page.locator('#asymmetry').inner_text()
    assert 'px' in page.locator('#diameter').inner_text()
    page.locator('#symptoms').select_option('yes')
    assert 'Solicita valoración' in page.locator('#advice').inner_text()
    with page.expect_download() as event: page.locator('#report').click()
    downloaded=event.value
    content=Path(downloaded.path()).read_text()
    assert 'NO DIAGNÓSTICO' in content and 'EJEMPLO SINTÉTICO' in content
    assert 'tamaño real desconocido' in content
    with page.expect_download() as event: page.locator('#export-image').click()
    assert event.value.suggested_filename=='luma-contorno.png'
    page.locator('#scale').click()
    page.locator('#photo').scroll_into_view_if_needed()
    box=page.locator('#photo').bounding_box()
    page.mouse.click(box['x']+box['width']*.2,box['y']+box['height']*.4)
    page.mouse.click(box['x']+box['width']*.4,box['y']+box['height']*.4)
    assert 'mm' in page.locator('#diameter').inner_text()
    page.locator('#clear-scale').click()
    assert 'px' in page.locator('#diameter').inner_text()
    page.locator('#show-mask').uncheck()
    page.locator('#show-mask').check()
    page.locator('[data-tool="remove"]').click()
    page.locator('#photo').scroll_into_view_if_needed()
    box=page.locator('#photo').bounding_box()
    page.mouse.click(box['x']+box['width']*.5,box['y']+box['height']*.5)
    assert page.locator('#report').is_disabled()
    assert page.locator('#analyze').is_disabled()
    page.locator('#undo').click()
    page.locator('#confirm').check()
    page.locator('#analyze').click()
    assert page.locator('#report').is_enabled()
    page.screenshot(path=str(ROOT/'tests/desktop.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'mobile horizontal overflow'
    page.screenshot(path=str(ROOT/'tests/mobile.png'),full_page=True)
    page.locator('#notes').fill('Solo datos sintéticos')
    page.locator('#erase-photo').click()
    assert page.locator('#photo').is_hidden()
    assert page.locator('#notes').input_value()==''
    assert page.locator('#report').is_disabled()
    page.locator('#file').set_input_files({'name':'not-image.png','mimeType':'image/png','buffer':b'not an image'})
    page.wait_for_function("document.getElementById('feedback').classList.contains('error')")
    assert page.locator('#analyze').is_disabled()
    assert not errors, errors
    browser.close()
print('PASS: synthetic demo, contour review gate, measurements, scale, edits, undo, exports, deletion, invalid upload, mobile overflow, no JS errors')
