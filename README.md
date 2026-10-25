# Luma · Observa tu piel

Aplicación estática en español para fotos normales de celular. Propone un contorno editable de una zona de color diferente, calcula medidas visuales y exporta una ficha para compartir con un profesional. Se ejecuta enteramente en el navegador y no necesita GPU, backend, modelos descargables ni entrenamiento.

**Esta versión NO detecta ni descarta cáncer, NO clasifica una lesión como benigna/maligna y NO estima una probabilidad de malignidad. No tiene precisión clínica validada.** Se implementó la parte de observación y medición; un predictor clínico de cáncer sigue pendiente y requiere un modelo y validación adecuados para fotos comunes de celular.

Si una lesión cambia, pica, sangra, se ve diferente a otras o te preocupa, solicita valoración dermatológica sin esperar un resultado de esta app. Los indicadores regulares no descartan enfermedad. Un melanoma puede medir menos de 6 mm. La guía ABCDE no cubre todos los tipos de cáncer cutáneo.

## Abrir localmente

```bash
cd /home/kali/dormido/lunar-observa
python3 -m http.server 8001 --bind 0.0.0.0
```

Abre `http://localhost:8001` desde la máquina que ejecuta el servidor. Para otro dispositivo en tu red usa la IP accesible de Kali y el puerto 8001, si tu VM y firewall permiten conexiones. La selección de fotos no necesita permiso de cámara ni HTTPS; para uso público es preferible HTTPS con GitHub Pages. No abras index.html como archivo local: usa un servidor HTTP por los módulos JavaScript.

## Flujo

1. Carga JPG, PNG o WebP (máximo 20 MB / 48 megapíxeles). Convierte HEIC a JPG. Usa buena luz, sin filtros, un lunar completo y piel visible alrededor. No fotografíes zonas identificables si no es necesario.
2. Marca una zona que rodee el lunar con margen. **Centro** permite seleccionar el punto de referencia cuando no está centrado.
3. Pulsa **Encontrar contorno**. Ajusta la amplitud si hace falta. Si el contraste no alcanza, prueba otra foto o usa el pincel; no se inventará un resultado.
4. Corrige con **Pincel**, **Borrador**, **Deshacer** y **Ampliar**. La confirmación de revisión es obligatoria para habilitar las medidas. Puedes delimitar totalmente a mano.
5. Opcional: si la foto contiene una regla en el mismo plano de la lesión, marca dos puntos y escribe la distancia real. Sin esta referencia se muestran píxeles, nunca milímetros estimados por el teléfono.
6. Indica cambios o síntomas, añade notas y descarga una ficha TXT o PNG anotado. El informe siempre conserva las limitaciones de uso.
7. **Eliminar** borra foto, notas y resultados de la sesión. No borra archivos ya descargados de tu dispositivo.

El ejemplo incluido es una forma generada por código, **no un lunar real ni un ejemplo clínico**.

## Privacidad

No hay API de análisis, cuentas, almacenamiento persistente, cookies, telemetría, librerías remotas ni solicitudes de imagen. Foto y notas permanecen en memoria. El navegador descarga solamente los archivos estáticos de la web; el hosting puede registrar esas solicitudes normales. Una política CSP restringe `connect-src` a `none`.

Solo se guardan los archivos que la persona decida descargar. La foto exportada se rasteriza sin copiar metadatos EXIF y lleva una advertencia visible. La ficha contiene el nombre original de archivo y las notas introducidas; revísala antes de compartirla. El código de publicación selecciona archivos explícitos para evitar subir fotos accidentalmente.

## Algoritmo y límites

- Reorientación de imagen mediante `createImageBitmap` y reducción a un máximo de 720 píxeles por lado. Las medidas de píxeles corresponden a esta copia de trabajo.
- Color CIELAB aproximado desde sRGB; estimación de la piel de referencia con medianas del anillo exterior de la zona seleccionada.
- Distancia de color al fondo, suavizado 3×3, umbral de Otsu con ajuste manual y componente conectada próxima al centro indicado. Relleno de huecos interiores.
- Rechazo de segmentación sin contraste, excesivamente pequeña o que alcance el límite de la zona. El contorno editable debe ser una sola región conectada y no tocar los bordes de la foto.
- Asimetría: fracción media de píxeles no coincidentes tras reflexiones sobre los ejes principales del contorno. **No es probabilidad de cáncer.**
- Borde: compacidad `4πA/P²`, con perímetro aproximado por marching squares. Está condicionada por resolución y forma; no constituye una puntuación médica de irregularidad.
- Color: dispersión RMS en Lab (ΔE76) dentro del contorno. No identifica colores diagnósticos ni aplica criterios clínicos.
- Extensión máxima: distancia entre vértices de la envolvente convexa, en píxeles. Los milímetros requieren escala aportada por la persona, sin corregir perspectiva o curvatura de piel.
- Avisos heurísticos de poco detalle, luces/sombras extremas y pocos píxeles. No certifican calidad y pueden activarse en zonas uniformes.

No hay detector de piel, reconocimiento de lunar, red neuronal ni clasificador de cáncer. El algoritmo puede delimitar cualquier objeto con contraste. El vello, las sombras, las lesiones claras, los reflejos y los cambios de iluminación pueden alterar o impedir la delimitación en cualquier tono de piel. La corrección manual no convierte el resultado en una medición clínica.

## Qué falta para una predicción clínica

1. Seleccionar un modelo con pesos, licencia y uso previsto compatibles con fotografías clínicas normales de celular. Un conjunto de imágenes dermatoscópicas por sí solo no valida este caso.
2. Usar datos con diagnósticos de referencia adecuados, incluyendo diversidad de tonos de piel, tipos de lesión, dispositivos y condiciones de captura.
3. Separar pacientes entre entrenamiento/validación/prueba y realizar validación externa prospectiva. Reportar sensibilidad, especificidad, falsos negativos, calibración, intervalos de confianza y comportamiento por subgrupos.
4. Detectar entradas fuera de distribución y evaluar el sistema completo con revisión clínica y requisitos regulatorios aplicables antes de ofrecer uso diagnóstico.

No se descargaron ni entrenaron pesos de un modelo médico. No se puede prometer «buena precisión» ni un porcentaje de riesgo a partir de las pruebas geométricas de esta app.

## Pruebas

Con Node 22:

```bash
npm test
node --check app.js
```

En Linux con JavaScriptCore GTK:

```bash
python3 tests/run_engine.py
```

Flujo de navegador con imágenes sintéticas:

```bash
python3 -m pip install playwright==1.55.0
python3 -m playwright install chromium
python3 tests/browser_check.py
```

Las pruebas de geometría incluyen conversión de color, segmentación de formas artificiales, imagen uniforme, región cortada, simetría, color uniforme/múltiple, componentes separadas, pincel y escala. El conjunto sintético **no sirve para afirmar precisión clínica ni exactitud de segmentación en pacientes**.

El workflow de GitHub Actions ejecuta las pruebas de motor y navegador antes de publicar. No basta con que existan estos archivos: la publicación solo se confirma con un despliegue exitoso de GitHub.

## GitHub Pages

```bash
gh auth login --hostname github.com --git-protocol https --web
bash publish.sh
```

Crea un repositorio público nuevo llamado `lunar-observa` en la cuenta autenticada y habilita Pages. No modifica el proyecto `conductor-alerta`. La URL prevista es `https://TU_USUARIO.github.io/lunar-observa/` una vez finalizado Actions. Si existe un repositorio ajeno con el mismo nombre, el script se detiene para evitar sobrescribirlo.

## Fuentes médicas

- [AAD: ABCDE del melanoma](https://www.aad.org/public/diseases/skin-cancer/abcdes-melanoma)
- [AAD: diagnóstico y tratamiento del melanoma](https://www.aad.org/public/diseases/skin-cancer/types/common/melanoma/diagnose-treat)
- [AAD: aplicaciones de salud y sus limitaciones](https://www.aad.org/public/fad/digital-health/apps)

Estas referencias sustentan el contenido educativo; no validan el algoritmo de esta aplicación.
