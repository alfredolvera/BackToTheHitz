# Back to the Hitz

**Back to the Hitz** es una experiencia de juego de mesa y trivia pop en la que las tarjetas físicas se combinan con una web app para viajar por la historia de la música, el cine y los videojuegos.

Los jugadores escanean códigos QR, reciben una pista audiovisual y colocan cada tarjeta en la posición correcta de su línea del tiempo. El reto no es solo reconocer la obra: también hay que recordar si llegó antes o después que los demás hitz.

## Tabla de contenidos

- [Descripción](#descripción)
- [Estado del proyecto](#estado-del-proyecto)
- [Características principales](#características-principales)
- [Cómo se juega](#cómo-se-juega)
- [Modos de juego](#modos-de-juego)
- [Web app](#web-app)
- [Formato de los QR](#formato-de-los-qr)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Desarrollo local](#desarrollo-local)
- [Despliegue](#despliegue)
- [Compatibilidad](#compatibilidad)
- [Créditos](#créditos)
- [Aviso legal](#aviso-legal)

## Descripción

Biff alteró la línea del tiempo y ahora toca restaurarla colocando canciones, películas y videojuegos en orden cronológico.

Cada tarjeta representa una obra de cultura pop. Al escanear su QR, la app muestra o reproduce una pista durante un tiempo limitado. Después, el jugador debe decidir dónde colocar la tarjeta respecto a las que ya tiene en su línea del tiempo.

- Las obras más antiguas van a la izquierda.
- Las obras más recientes van a la derecha.
- Si dos tarjetas pertenecen al mismo año, pueden colocarse en cualquier orden entre ellas.

## Estado del proyecto

Este repositorio contiene una versión estática y desplegable de la web app de **Back to the Hitz**. No utiliza un framework ni requiere instalación de dependencias para ejecutarse localmente.

Incluye:

- Pantalla inicial del juego.
- Escáner QR con cámara.
- Reproductor de pistas mediante YouTube IFrame API.
- Pantalla de cuenta regresiva y aviso para colocar la tarjeta.
- Página de reglas en español.
- Manifest PWA y service worker para cachear recursos principales.
- Configuración básica para Netlify.

## Características principales

- Juego de trivia cronológica con tarjetas físicas.
- Categorías de música, películas y videojuegos.
- Escaneo de QR desde navegador usando la cámara del dispositivo.
- Pistas audiovisuales con videos de YouTube o modo visualizador para pistas de audio.
- Ambientación retro inspirada en viajes temporales.
- Fichas DeLorean para cambiar tarjetas, retar jugadas y activar ventajas.
- Modos Original, Caos y Cooperativo.
- Aplicación web estática compatible con hosting simple.

## Cómo se juega

1. El jugador o equipo toma una tarjeta del mazo activo.
2. Escanea el código QR con la web app.
3. Observa o escucha la pista sin mirar el año de la tarjeta.
4. Coloca la tarjeta boca abajo en su línea del tiempo.
5. Revela el año.
6. Si la posición es correcta, conserva la tarjeta.
7. Si la posición es incorrecta, descarta la tarjeta salvo que aplique una regla especial.

El objetivo habitual es colocar correctamente **10 tarjetas** antes que los demás jugadores o equipos.

## Modos de juego

### Modo Original

Cada jugador o equipo construye su propia línea del tiempo. Gana quien coloque correctamente 10 tarjetas.

### Modo Caos

Se mezclan categorías. En un mismo turno puede aparecer una canción, una película o un videojuego, lo que hace la partida más impredecible.

### Modo Cooperativo

Todos los jugadores comparten una sola línea del tiempo y trabajan juntos para restaurar la historia antes de quedarse sin fichas DeLorean.

## Web app

La web app sirve como acompañante digital del juego físico.

Flujo principal:

1. `index.html` muestra la pantalla inicial y el botón para escanear.
2. `script.js` inicializa el lector QR y procesa el contenido del código.
3. Cuando el QR es válido, la app carga la pista con YouTube IFrame API.
4. Tras la pista, se muestra la pantalla de tiempo terminado para que el jugador coloque la tarjeta.
5. `rules.html` contiene las reglas del juego.

Sitio principal previsto:

```text
https://www.backtothehitz.com
```

## Formato de los QR

La app espera parámetros en el texto del QR para identificar la categoría y el video.

Parámetros soportados:

| Parámetro | Categoría | Descripción |
| --- | --- | --- |
| `c` | Cine | ID de video de YouTube para una pista de película. |
| `g` | Juego | ID de video de YouTube para una pista de videojuego. |
| `mv` | Música video | ID de video de YouTube para una pista musical con video. |
| `ma` | Música audio | ID de video de YouTube para una pista musical tratada como audio. |
| `s` | Inicio | Segundo de inicio opcional para reproducir la pista. |

Ejemplos:

```text
c=dQw4w9WgXcQ
```

```text
ma=dQw4w9WgXcQ&s=42
```

El archivo `replacements.json` permite reemplazar IDs de video por otros y, opcionalmente, definir un nuevo tiempo de inicio.

## Estructura del repositorio

```text
BackToTheHitz/
├── index.html          # Pantalla principal y escáner
├── rules.html          # Reglas del juego
├── style.css           # Estilos de la app principal
├── rules.css           # Estilos de la página de reglas
├── script.js           # Lógica del escáner, YouTube y flujo de juego
├── sw.js               # Service worker para cache offline básico
├── manifest.json       # Manifest de PWA
├── replacements.json   # Reemplazos de videos para tarjetas existentes
├── netlify.toml        # Redirección SPA/static para Netlify
├── robots.txt          # Directivas para bots
├── icons/              # Íconos de la app
└── *.mp3, *.gif, *.png # Recursos audiovisuales y gráficos
```

## Desarrollo local

No hay dependencias de Node, bundler ni paso de compilación. Basta con servir los archivos estáticos desde un servidor local.

Con Python:

```bash
python3 -m http.server 8000
```

Luego abre:

```text
http://localhost:8000
```

> Nota: el escaneo con cámara suele requerir un contexto seguro. En producción usa HTTPS. En desarrollo, muchos navegadores permiten cámara en `localhost`.

Para omitir el registro del service worker durante pruebas, abre la app con:

```text
http://localhost:8000/?dev=true
```

## Despliegue

El proyecto puede desplegarse como sitio estático.

Opciones recomendadas:

- Netlify
- Vercel
- Cloudflare Pages
- GitHub Pages
- Cualquier servidor web estático con HTTPS

La configuración incluida para Netlify redirige todas las rutas hacia `index.html`.

## Compatibilidad

Para la mejor experiencia se recomienda usar:

- Google Chrome
- Microsoft Edge
- Brave
- Firefox
- Otros navegadores modernos basados en Chromium

Requisitos importantes:

- Permiso de cámara habilitado.
- Conexión a internet para cargar YouTube y la librería del escáner QR desde CDN.
- HTTPS en producción.

Safari puede presentar limitaciones con cámara, reproducción automática o APIs utilizadas por la app.

## Créditos

Creado por **Alfredo Olvera**.

Dedicado para Rebeca e inspirado por la nostalgia, la música, el cine, los videojuegos y el caos temporal.

## Aviso legal

**Back to the Hitz** es un proyecto fan-made de juego de mesa y trivia cultural.

Las canciones, películas, videojuegos, personajes, marcas, imágenes, videos, nombres y demás referencias pertenecen a sus respectivos titulares. Este repositorio no otorga derechos sobre contenido de terceros.

El proyecto está pensado para uso personal, privado, educativo o no comercial salvo que se indique lo contrario. No distribuyas material protegido por derechos de autor sin autorización.

## Licencia

No se ha seleccionado una licencia open source para este repositorio. Mientras no exista un archivo de licencia, todos los derechos quedan reservados.
