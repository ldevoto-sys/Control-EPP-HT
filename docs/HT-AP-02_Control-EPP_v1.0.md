# HT-AP-02 — Sistema de Control de EPP

| Campo | Valor |
|---|---|
| Código | HT-AP-02 |
| Versión | 1.0 |
| Fecha | 2026-06-13 |
| Estado | Borrador |
| Responsable | Gerencia General — Luis Devoto (ldevoto@hidrotecnica.cl) |
| Empresa | HidroTecnica SpA |

---

## 1. Propósito

El sistema registra y controla la entrega, devolución y estado de Equipos de Protección Personal (EPP) asignados a trabajadores de HidroTecnica SpA. Centraliza el ciclo completo: solicitud, autorización, despacho desde bodega, firma del documento de entrega, devolución y trazabilidad de stock.

Objetivo principal: mantener evidencia documental auditable de que cada trabajador cuenta con EPP vigente, correctamente entregado y con certificado técnico asociado.

---

## 2. Alcance y Usuarios

### 2.1 Alcance

Cubre todas las operaciones de EPP internas de HidroTecnica SpA: solicitud por parte de operadores, aprobación, despacho desde bodega, generación de documentos de entrega (para firma digital en Buk o firma en papel), devolución y consulta de historial.

No cubre: compras a proveedores, inventario general de bodega, ni EPP de empresas contratistas externas.

### 2.2 Roles y permisos

| Rol | Descripción | Acciones principales |
|---|---|---|
| `administrador` | Acceso total al sistema | CRUD usuarios, catálogo EPP, stock, reportes, configuración |
| `autorizador` | Aprueba o rechaza solicitudes | Ver solicitudes pendientes, aprobar, rechazar con motivo |
| `bodega` | Gestiona despacho y devolución | Registrar entregas, cargar certificados, registrar devoluciones, ingreso de stock |
| `operador` | Trabajador que solicita EPP | Crear solicitudes, ver historial propio |
| `consulta` | Solo lectura | Ver asignaciones activas, ficha de trabajador, documentación |

---

## 3. Stack Tecnológico

| Capa | Tecnología | Versión referencial |
|---|---|---|
| Backend | Node.js + Express | Node 20 LTS |
| Base de datos | SQLite (archivo único) | better-sqlite3 |
| Frontend | React 18 + Vite + Tailwind CSS | React 18, Vite 5, Tailwind 3 |
| Generación PDF | pdfkit | 0.14.x |
| Correo electrónico | Nodemailer | 6.x |
| Autenticación | JWT (jsonwebtoken) | HS256 |
| Despliegue | Railway.app | — |

El frontend se sirve como build estático desde el mismo proceso Node en producción. En desarrollo se ejecutan en puertos separados con proxy Vite.

---

## 4. Modelo de Datos

Todas las tablas usan `id INTEGER PRIMARY KEY AUTOINCREMENT` salvo indicación contraria. Los campos de fecha son `TEXT` en formato ISO 8601.

### 4.1 Tablas

#### `users`
Usuarios del sistema.

| Columna | Tipo | Descripción |
|---|---|---|
| id | INTEGER | PK |
| rut | TEXT UNIQUE | RUT chileno validado (sin puntos, con guion) |
| nombre | TEXT | Nombre completo |
| email | TEXT UNIQUE | Correo electrónico |
| password_hash | TEXT | Hash bcrypt |
| rol | TEXT | `administrador`, `autorizador`, `bodega`, `operador`, `consulta` |
| activo | INTEGER | 1 = activo, 0 = inactivo |
| reset_token | TEXT | Token de recuperación de contraseña (nullable) |
| reset_token_expiry | TEXT | Expiración del token |
| created_at | TEXT | Fecha de creación |

#### `epp_catalogo`
Tipos de EPP disponibles. Configurable desde administración.

| Columna | Tipo | Descripción |
|---|---|---|
| id | INTEGER | PK |
| nombre | TEXT | Nombre del EPP (ej. "Casco seguridad") |
| descripcion | TEXT | Descripción técnica |
| unidad | TEXT | Unidad de medida (ej. "unidad", "par") |
| vida_util_dias | INTEGER | Días de vida útil estimada (nullable) |
| stock_minimo | INTEGER | Umbral para alerta de stock crítico |
| activo | INTEGER | 1 = disponible para solicitar |
| certificado_url | TEXT | Ruta del PDF de certificado técnico del tipo de EPP (nullable) |
| created_at | TEXT | — |

#### `solicitudes_epp`
Cabecera de cada solicitud de EPP.

| Columna | Tipo | Descripción |
|---|---|---|
| id | INTEGER | PK |
| usuario_id | INTEGER | FK → users (solicitante) |
| estado | TEXT | `pendiente`, `aprobada`, `rechazada`, `entregada` |
| motivo_rechazo | TEXT | Motivo si fue rechazada (nullable) |
| autorizador_id | INTEGER | FK → users (quien autorizó/rechazó, nullable) |
| created_at | TEXT | — |
| updated_at | TEXT | — |

#### `solicitud_items`
Líneas de cada solicitud.

| Columna | Tipo | Descripción |
|---|---|---|
| id | INTEGER | PK |
| solicitud_id | INTEGER | FK → solicitudes_epp |
| epp_id | INTEGER | FK → epp_catalogo |
| cantidad | INTEGER | Cantidad solicitada |

#### `entregas_epp`
Registro de cada acto de entrega física.

| Columna | Tipo | Descripción |
|---|---|---|
| id | INTEGER | PK |
| solicitud_id | INTEGER | FK → solicitudes_epp |
| usuario_id | INTEGER | FK → users (receptor) |
| bodega_user_id | INTEGER | FK → users (quien entregó) |
| fecha_entrega | TEXT | Fecha real de entrega |
| documento_url | TEXT | Ruta del PDF de entrega generado |
| documento_firmado_url | TEXT | Ruta del PDF firmado subido (nullable) |
| created_at | TEXT | — |

#### `entrega_items`
Detalle de ítems entregados en cada entrega.

| Columna | Tipo | Descripción |
|---|---|---|
| id | INTEGER | PK |
| entrega_id | INTEGER | FK → entregas_epp |
| epp_id | INTEGER | FK → epp_catalogo |
| cantidad | INTEGER | — |
| numero_lote | TEXT | Lote del proveedor (nullable) |
| certificado_lote_url | TEXT | Ruta del PDF de certificado del lote específico (nullable) |

#### `asignaciones_activas`
Vista materializada del EPP actualmente en poder de cada trabajador.

| Columna | Tipo | Descripción |
|---|---|---|
| id | INTEGER | PK |
| usuario_id | INTEGER | FK → users |
| epp_id | INTEGER | FK → epp_catalogo |
| cantidad | INTEGER | — |
| fecha_entrega | TEXT | — |
| entrega_id | INTEGER | FK → entregas_epp |
| fecha_vencimiento | TEXT | Calculada según vida_util_dias (nullable) |

#### `devoluciones_epp`
Registro de devoluciones.

| Columna | Tipo | Descripción |
|---|---|---|
| id | INTEGER | PK |
| usuario_id | INTEGER | FK → users (quien devuelve) |
| bodega_user_id | INTEGER | FK → users (quien recibe) |
| epp_id | INTEGER | FK → epp_catalogo |
| cantidad | INTEGER | — |
| estado_devolucion | TEXT | `bueno`, `deteriorado`, `dado_de_baja` |
| observaciones | TEXT | nullable |
| fecha_devolucion | TEXT | — |
| created_at | TEXT | — |

#### `stock_movimientos`
Trazabilidad de todos los movimientos de stock.

| Columna | Tipo | Descripción |
|---|---|---|
| id | INTEGER | PK |
| epp_id | INTEGER | FK → epp_catalogo |
| tipo | TEXT | `ingreso`, `egreso`, `devolucion`, `ajuste` |
| cantidad | INTEGER | Positivo o negativo según tipo |
| referencia_id | INTEGER | ID del documento origen (nullable) |
| referencia_tipo | TEXT | `entrega`, `devolucion`, `ajuste_manual` (nullable) |
| usuario_id | INTEGER | FK → users (quien realizó el movimiento) |
| observaciones | TEXT | nullable |
| created_at | TEXT | — |

#### `solicitud_historial`
Log de cambios de estado de cada solicitud.

| Columna | Tipo | Descripción |
|---|---|---|
| id | INTEGER | PK |
| solicitud_id | INTEGER | FK → solicitudes_epp |
| estado_anterior | TEXT | — |
| estado_nuevo | TEXT | — |
| usuario_id | INTEGER | FK → users (quien realizó el cambio) |
| observaciones | TEXT | nullable |
| created_at | TEXT | — |

---

## 5. Flujos Principales

### 5.1 Solicitud y Entrega

```
Operador
  └─ Crea solicitud (estado: pendiente)
       └─ Email a autorizadores

Autorizador
  ├─ Aprueba (estado: aprobada)
  │    └─ Email a bodega y solicitante
  └─ Rechaza con motivo (estado: rechazada)
       └─ Email a solicitante

Bodega
  └─ Registra entrega física (estado: entregada)
       ├─ Genera PDF de entrega (trabajador, EPP, fecha, espacio de firma)
       ├─ Descuenta stock y registra en stock_movimientos
       ├─ Actualiza asignaciones_activas
       └─ Email a solicitante con documento adjunto
```

### 5.2 Devolución

```
Bodega o Administrador
  └─ Registra devolución
       ├─ Indica estado del EPP devuelto
       ├─ Actualiza asignaciones_activas (reduce o elimina)
       ├─ Si estado = "bueno": suma al stock disponible
       ├─ Registra en stock_movimientos
       └─ Email de confirmación al trabajador
```

### 5.3 Ingreso a Stock

```
Administrador o Bodega
  └─ Registra ingreso de EPP
       ├─ Selecciona tipo de EPP del catálogo
       ├─ Indica cantidad, lote y proveedor (opcional)
       ├─ Sube certificado técnico del lote (PDF, opcional)
       ├─ Registra en stock_movimientos (tipo: ingreso)
       └─ Si stock supera mínimo: cancela alerta crítica activa
```

---

## 6. Funcionalidades Clave

### 6.1 Certificados de EPP

- Bodega puede subir un PDF de certificado técnico a nivel de catálogo (aplica a todo el tipo de EPP).
- También puede subir un certificado específico por lote en cada `entrega_item` (`certificado_lote_url`).
- Ambos certificados quedan asociados al documento de entrega.

### 6.2 Documento de Entrega (PDF exportable)

El sistema genera un PDF por entrega con:

- Datos del trabajador (nombre, RUT, cargo si existe)
- Listado de EPP entregado (descripción, cantidad, lote)
- Fecha de entrega
- Espacio para firma del receptor y del responsable de bodega
- Certificados técnicos anexados (del tipo y/o del lote)

El documento está diseñado para:

a. Subirse a **Buk** para firma digital electrónica.  
b. Imprimirse y firmarse en papel.

### 6.3 Documento Firmado

- Una vez obtenida la firma (Buk o papel escaneado), bodega o administrador sube el PDF firmado.
- El archivo queda asociado a `entregas_epp.documento_firmado_url`.
- Visible en la ficha del trabajador y en la vista de documentación.

### 6.4 Vista de Documentación (Matriz Trabajador × EPP)

Tabla donde:

- **Filas**: trabajadores activos
- **Columnas**: tipos de EPP configurados como visibles en la matriz
- **Celda**: muestra estado del documento de la última entrega (sin documento / pendiente firma / firmado) con acceso de descarga
- **Por fila**: botón para descargar todas las entregas del trabajador en un ZIP o PDF combinado

Permite a administración verificar de un vistazo qué trabajadores tienen EPP al día y documentación completa.

### 6.5 Ficha del Trabajador

Vista individual por trabajador con:

- EPP actualmente asignado (asignaciones_activas)
- Historial de todas las entregas
- Historial de devoluciones
- Documentos de entrega generados y firmados, descargables
- Alertas de EPP próximo a vencer

### 6.6 Tipos de EPP Configurables

Desde el módulo de administración, CRUD completo sobre `epp_catalogo`:

- Crear, editar y desactivar tipos de EPP
- Configurar vida útil, stock mínimo y unidad de medida
- Subir o reemplazar el certificado técnico del tipo
- Marcar si el tipo es visible en la vista de documentación (matriz)

---

## 7. API REST

Todos los endpoints requieren header `Authorization: Bearer <token>` salvo `/auth/login` y `/auth/reset-password`.

Las respuestas usan formato JSON `{ data, error, message }`.

### 7.1 Autenticación (`/api/auth`)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| POST | `/login` | Obtiene JWT | Todos |
| POST | `/logout` | Invalida sesión (cliente) | Autenticado |
| POST | `/reset-request` | Envía email con token de reset | Público |
| POST | `/reset-password` | Cambia contraseña con token | Público |
| GET | `/me` | Datos del usuario autenticado | Autenticado |

### 7.2 Usuarios (`/api/users`)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/` | Lista usuarios | Admin |
| POST | `/` | Crea usuario | Admin |
| GET | `/:id` | Obtiene usuario | Admin, propio |
| PUT | `/:id` | Edita usuario | Admin |
| PATCH | `/:id/toggle-activo` | Activa/desactiva | Admin |

### 7.3 Catálogo EPP (`/api/epp`)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/` | Lista catálogo | Todos |
| POST | `/` | Crea tipo de EPP | Admin |
| PUT | `/:id` | Edita tipo | Admin |
| DELETE | `/:id` | Desactiva tipo | Admin |
| POST | `/:id/certificado` | Sube PDF certificado tipo | Admin, Bodega |
| GET | `/stock` | Stock actual por tipo | Admin, Bodega |

### 7.4 Solicitudes (`/api/solicitudes`)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/` | Lista solicitudes (filtrable) | Admin, Autorizador, Bodega |
| POST | `/` | Crea solicitud | Operador |
| GET | `/:id` | Detalle de solicitud | Según rol |
| PATCH | `/:id/aprobar` | Aprueba | Autorizador, Admin |
| PATCH | `/:id/rechazar` | Rechaza con motivo | Autorizador, Admin |
| GET | `/mias` | Solicitudes del usuario autenticado | Operador |

### 7.5 Entregas (`/api/entregas`)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| POST | `/` | Registra entrega | Bodega, Admin |
| GET | `/:id` | Detalle de entrega | Admin, Bodega |
| GET | `/:id/documento` | Descarga PDF generado | Autenticado |
| POST | `/:id/documento-firmado` | Sube PDF firmado | Bodega, Admin |
| GET | `/:id/documento-firmado` | Descarga PDF firmado | Autenticado |
| POST | `/:id/items/:itemId/certificado-lote` | Sube certificado de lote | Bodega, Admin |

### 7.6 Asignaciones (`/api/asignaciones`)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/` | Todas las asignaciones activas | Admin, Bodega, Consulta |
| GET | `/usuario/:id` | EPP activo de un trabajador | Admin, Bodega, Consulta, propio |

### 7.7 Devoluciones (`/api/devoluciones`)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| POST | `/` | Registra devolución | Bodega, Admin |
| GET | `/` | Lista devoluciones | Admin, Bodega |
| GET | `/:id` | Detalle | Admin, Bodega |

### 7.8 Stock (`/api/stock`)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| POST | `/ingreso` | Registra ingreso de EPP | Admin, Bodega |
| GET | `/movimientos` | Historial de movimientos | Admin, Bodega |
| GET | `/movimientos/:epp_id` | Movimientos por tipo | Admin, Bodega |
| GET | `/alertas` | EPP bajo stock mínimo | Admin, Bodega |

### 7.9 Reportes (`/api/reports`)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/matriz` | Datos de matriz trabajador × EPP | Admin, Consulta, Autorizador |
| GET | `/trabajador/:id` | Ficha completa del trabajador | Admin, Consulta |
| GET | `/trabajador/:id/zip` | ZIP de todos los documentos | Admin, Consulta |

---

## 8. Seguridad

| Aspecto | Implementación |
|---|---|
| Autenticación | JWT firmado con HS256, expiración configurable (default 8h) |
| Contraseñas | Hash bcrypt, costo mínimo 10 |
| Requisitos de contraseña | Mínimo 8 caracteres, al menos 1 mayúscula, 1 número |
| Validación RUT | Algoritmo de dígito verificador chileno en backend y frontend |
| Reset de contraseña | Token de un solo uso con expiración de 1 hora |
| Control de acceso | Middleware por rol en cada endpoint |
| Subida de archivos | Solo PDF, tamaño máximo 10 MB, nombre aleatorio en servidor |
| Variables sensibles | Solo en variables de entorno, nunca en código |

---

## 9. Emails Automáticos

Sistema de notificaciones con Nodemailer. Las plantillas son texto plano con datos dinámicos.

| Evento | Destinatario(s) | Contenido |
|---|---|---|
| Creación de usuario | Usuario nuevo | Credenciales iniciales y enlace de primer acceso |
| Solicitud enviada | Autorizadores | Datos del solicitante y EPP requerido |
| Solicitud aprobada | Solicitante | Confirmación, EPP aprobado |
| Solicitud rechazada | Solicitante | Motivo del rechazo |
| Entrega registrada | Solicitante | Confirmación con PDF de entrega adjunto |
| Stock crítico | Administradores, Bodega | Tipo de EPP y stock actual |
| Reset de contraseña | Usuario | Enlace con token (expira 1 hora) |

---

## 10. Despliegue

### 10.1 Plataforma

Railway.app con un único servicio que sirve backend y frontend compilado.

### 10.2 Variables de Entorno Requeridas

| Variable | Descripción |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | Puerto del servidor (Railway lo asigna automáticamente) |
| `JWT_SECRET` | Clave secreta para firmar tokens (mínimo 32 caracteres) |
| `JWT_EXPIRY` | Expiración del token (ej. `8h`) |
| `DB_PATH` | Ruta absoluta al archivo SQLite en el volumen persistente |
| `UPLOAD_PATH` | Ruta absoluta al directorio de archivos subidos |
| `SMTP_HOST` | Servidor SMTP |
| `SMTP_PORT` | Puerto SMTP (ej. `587`) |
| `SMTP_USER` | Usuario SMTP |
| `SMTP_PASS` | Contraseña SMTP |
| `EMAIL_FROM` | Dirección remitente (ej. `noreply@hidrotecnica.cl`) |
| `FRONTEND_URL` | URL pública del sistema (para links en emails) |

### 10.3 Volumen Persistente

SQLite y archivos subidos (PDFs) deben montarse en un volumen persistente en Railway. Sin volumen, los datos se pierden en cada deploy.

Rutas recomendadas:

```
/data/epp.db         → DB_PATH
/data/uploads/       → UPLOAD_PATH
```

### 10.4 Build y Start

```bash
# Build
npm install
npm run build        # compila frontend con Vite

# Start
node server.js       # sirve API + frontend compilado
```

---

## 11. Checklist MVP

### Backend
- [ ] Modelo de datos: migraciones y seed inicial
- [ ] Autenticación JWT (login, logout, reset)
- [ ] CRUD usuarios con validación RUT
- [ ] CRUD catálogo EPP
- [ ] Flujo solicitud (crear, aprobar, rechazar)
- [ ] Flujo entrega (registrar, generar PDF, descontar stock)
- [ ] Flujo devolución (registrar, actualizar stock y asignaciones)
- [ ] Ingreso a stock
- [ ] Subida de certificados (tipo y lote)
- [ ] Subida de documento firmado
- [ ] Endpoint matriz trabajador × EPP
- [ ] Endpoint ficha de trabajador + ZIP documentos
- [ ] Alertas de stock crítico
- [ ] Emails automáticos (todos los eventos)
- [ ] Middleware de roles

### Frontend
- [ ] Login y recuperación de contraseña
- [ ] Panel operador: crear solicitud, ver historial propio
- [ ] Panel autorizador: aprobar/rechazar solicitudes
- [ ] Panel bodega: registrar entrega, devolución, ingreso stock, subir certificados y documentos firmados
- [ ] Panel admin: CRUD usuarios, CRUD catálogo EPP, reportes
- [ ] Vista matriz trabajador × EPP con descarga
- [ ] Ficha de trabajador
- [ ] Alertas de stock crítico visibles en dashboard

### Despliegue
- [ ] Variables de entorno configuradas en Railway
- [ ] Volumen persistente montado
- [ ] Build y start validados en producción
- [ ] Usuario administrador inicial creado

---

*Documento generado por Gerencia General. Revisión pendiente antes de inicio de desarrollo.*
