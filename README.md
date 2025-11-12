# ⚡ Simulador de Campo Eléctrico 2D y 3D

Este proyecto es un **simulador interactivo de campos eléctricos** en entornos **2D y 3D**, diseñado para visualizar la influencia de cargas eléctricas en el espacio.  
Está potenciado por la librería **[Three.js](https://threejs.org/)**, lo que permite renderizados en tiempo real con efectos visuales dinámicos, líneas de campo y vectores de fuerza.

---

## 🌐 Características principales

- **Visualización 2D y 3D** del campo eléctrico.  
- **Interfaz interactiva**: agrega, mueve y elimina cargas.  
- **Renderizado con Three.js**, optimizado para navegadores modernos.  
- **Backend en FastAPI**, para gestionar datos y simulaciones físicas.  
- **Arquitectura modular**, ideal para extender con más tipos de cargas o campos.  

---

## 🧠 Fundamento teórico

El simulador se basa en la **Ley de Coulomb**, que establece la interacción entre cargas eléctricas mediante el campo eléctrico **E**:

\[
\vec{E} = k \frac{q}{r^2} \hat{r}
\]

Donde:
- \( q \): magnitud de la carga.  
- \( r \): distancia al punto de observación.  
- \( k \): constante de Coulomb \( (8.99 \times 10^9 \, N·m^2/C^2) \).  

Cada carga genera un campo, y el simulador representa la **superposición vectorial** de todos los campos en la escena.

---

## 🛠️ Instalación y uso local

Asegúrate de tener **Python 3.10+**, **[uv](https://github.com/astral-sh/uv)** y **Uvicorn** instalados.

### 1️⃣ Clonar el repositorio
```bash
git clone https://github.com/tu_usuario/simulador-campo-electrico.git
cd simulador-campo-electrico
```

### 2️⃣ Instalar dependencias
Usamos `uv` como gestor ultrarrápido de entornos y dependencias:
```bash
uv sync
```

### 3️⃣ Iniciar el backend (FastAPI)
Ubícate en la raíz del proyecto y ejecuta:
```bash
uv run uvicorn app.server.main:app --reload
```

El servidor se ejecutará por defecto en `http://127.0.0.1:8000`.

### 4️⃣ Iniciar el frontend (Three.js)
Dentro de la carpeta `web`, levanta un servidor HTTP local:
```bash
cd web
python -m http.server 5173
```

Luego abre tu navegador en [http://localhost:5173](http://localhost:5173)  
para visualizar el simulador en acción.

---

## 🧩 Estructura del proyecto

```
📂 simulador-campo-electrico/
│
├── 📁 app/
│   ├── server/
│   │   └── main.py          # Servidor FastAPI principal
│   └── simulations/
│       └── sim.py         # Cálculos del campo eléctrico
│
├── 📁 web/
│   ├── index.html           # Interfaz principal
│   ├── main.js              # Renderizado con Three.js
│   └── styles.css           # Estilos del simulador
│
├── pyproject.toml           # Configuración de dependencias
└── README.md
```

---

## 💡 Recomendaciones

- Usa **Google Chrome o Firefox** para mejor rendimiento 3D.  
- Asegúrate de mantener el backend corriendo antes de abrir el frontend.  
- Si cambias el puerto, actualízalo también en las llamadas fetch del frontend.  

---

## 🚀 Créditos

Desarrollado con ❤️ por [Tu Nombre o Equipo]  
Potenciado por **Three.js**, **FastAPI** y **uv**.  

---
✨ *Explora, visualiza y comprende el poder invisible de los campos eléctricos.*