# HT-AP-02 — Sistema de Control de EPP

| Campo | Valor |
|---|---|
| Codigo | HT-AP-02 |
| Version | 1.0 |
| Fecha | 2026-06-13 |
| Estado | Borrador |
| Responsable | Gerencia General — Luis Devoto (ldevoto@hidrotecnica.cl) |
| Empresa | HidroTecnica SpA |

---

## 1. Proposito

El sistema registra y controla la entrega, devolucion y estado de Equipos de Proteccion Personal (EPP) asignados a trabajadores de HidroTecnica SpA. Centraliza el ciclo completo: solicitud, autorizacion, despacho desde bodega, firma del documento de entrega, devolucion y trazabilidad de stock.

Objetivo principal: mantener evidencia documental auditabe de que cada trabajador cuenta con EPP vigente, correctamente entregado y con certificado tecnico asociado.

---

## 2. Alcance y Usuarios

### 2.1 Alcance

Cubre todas las operaciones de EPP internas de HidroTecnica SpA: solicitud por parte de operadores, aprobacion, despacho desde bodega, generacion de documentos de entrega (para firma digital en Buk o firma en papel), devolucion y consulta de historial.

No cubre: compras a proveedores, inventario general de bodega, ni EPP de empresas contratistas externas.

### 2.2 Roles y permisos

| Rol | Descripcion | Acciones principales |
|---|---|---|
| `administrador` | Acceso total al sistema | CRUD usuarios, catalogo EPP, stock, reportes, configuracion |
| `autorizador` | Aprueba o rechaza solicitudes | Ver solicitudes pendientes, aprobar, rechazar con motivo |
| `bodega` | Gestiona despacho y devolucion | Registrar entregas, cargar certificados, registrar devoluciones, ingreso de stock |
| `operador` | Trabajador que solicita EPP | Crear solicitudes, ver historial propio |
| `consulta` | Solo lectura | Ver asignaciones activas, ficha de trabajador, documentacion |

---

## 3. Stack Tecnologico

| Capa | Tecnologia | Version referencial |
|---|---|---|
| Backend | Node.js + Express | Node 20 LTS |
| Base de datos | SQLite (archivo unico) | better-sqlite3 |
| Frontend | React 18 + Vite + Tailwind CSS | React 18, Vite 5, Tailwind 3 |
| Generacion PDF | pdfkit | 0.14.x |
| Correo electronico | Nodemailer | 6.x |
| Autenticacion | JWT (jsonwebtoken) | HS256 |
| Despliegue | Railway.app | — |

El frontend se sirve como build estatico desde el mismo proceso Node en produccion. En desarrollo se ejecutan en puertos separados con proxy Vite.

---

## 4. Modelo de Datos

Todas las tablas usan `id INTEGER PRIMARY KEY AUTOINCREMENT` salvo indicacion contraria. Los campos de fecha son `TEXT` en formato ISO 8601.

### 4.1 Tablas

#### `users`
Usuarios del sistema.

| Columna | Tipo | Descripcion |
|---|---|---|
| id | INTEGER | PK |
| rut | TEXT UNIQUE | RUT chileno validado (sin puntos, con guion) |
| nombre | TEXT | Nombre completo |
| email | TEXT UNIQUE | Correo electronico |
| password_hash | TEXT | Hash bcrypt |
| rol | TEXT | `administrador`, `autorizador`, `bodega`, `operador`, `consulta` |
| activo | INTEGER | 1 = activo, 0 = inactivo |
| reset_token | TEXT | Token de recuperacion de contrasena (nullable) |
| reset_token_expiry | TEXT | Expiracion del token |
| created_at | TEXT | Fecha de creacion |

#### `epp_catalogo`
Tipos de EPP disponibles. Configurable desde administracion.

| Columna | Tipo | Descripcion |
|---|---|---|
| id | INTEGER | PK |
| nombre | TEXT | Nombre del EPP (ej. "Casco seguridad") |
| descripcion | TEXT | Descripcion tecnica |
| unidad | TEXT | Unidad de medida (ej. "unidad", "par") |
| vida_util_dias | INTEGER | Dias de vida util estimada (nullable) |
| stock_minimo | INTEGER | Umbral para alerta de stock critico |
| activo | INTEGER | 1 = disponible para solicitar |
| certificado_url | TEXT | Ruta del PDF de certificado tecnico del tipo de EPP (nullable) |
| created_at | TEXT | — |

#### `solicitudes_epp`
Cabecera de cada solicitud de EPP.

| Columna | Tipo | Descripcion |
|---|---|---|
| id | INTEGER | PK |
| usuario_id | INTEGER | FK → users (solicitante) |
| estado | TEXT | `pendiente`, `aprobada`, `rechazada`, `entregada` |
| motivo_rechazo | TEXT | Motivo si fue rechazada (nullable) |
| autorizador_id | INTEGER | FK → users (quien autorizo/rechazo, nullable) |
| created_at | TEXT | — |
| updated_at | TEXT | — |

#### `solicitud_items`
Lineas de cada solicitud.

| Columna | Tipo | Descripcion |
|---|---|---|
| id | INTEGER | PK |
| solicitud_id | INTEGER | FK → solicitudes_epp |
| epp_id | INTEGER | FK → epp_catalogo |
| cantidad | INTEGER | Cantidad solicitada |

#### `entregas_epp`
Registro de cada acto de entrega fisica.

| Columna | Tipo | Descripcion |
|---|---|---|
| id | INTEGER | PK |
| solicitud_id | INTEGER | FK → solicitudes_epp |
| usuario_id | INTEGER | FK → users (receptor) |
| bodega_user_id | INTEGER | FK → users (quien entrego) |
| fecha_entrega | TEXT | Fecha real de entrega |
| documento_url | TEXT | Ruta del PDF de entrega generado |
| documento_firmado_url | TEXT | Ruta del PDF firmado subido (nullable) |
| created_at | TEXT | — |

#### `entrega_items`
Detalle de items entregados en cada entrega.

| Columna | Tipo | Descripcion |
|---|---|---|
| id | INTEGER | PK |
| entrega_id | INTEGER | FK → entregas_epp |
| epp_id | INTEGER | FK → epp_catalogo |
| cantidad | INTEGER | — |
| numero_lote | TEXT | Lote del proveedor (nullable) |
| certificado_lote_url | TEXT | Ruta del PDF de certificado del lote especifico (nullable) |

#### `asignaciones_activas`
Vista materializada del EPP actualmente en poder de cada trabajador.

| Columna | Tipo | Descripcion |
|---|---|---|
| id | INTEGER | PK |
| usuario_id | INTEGER | FK → users |
| epp_id | INTEGER | FK → epp_catalogo |
| cantidad | INTEGER | — |
| fecha_entrega | TEXT | — |
| entrega_id | INTEGER | FK → entregas_epp |
| fecha_vencimiento | TEXT | Calculada segun vida_util_dias (nullable) |

#### `devoluciones_epp`
Registro de devoluciones.

| Columna | Tipo | Descripcion |
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

| Columna | Tipo | Descripcion |
|---|---|---|
| id | INTEGER | PK |
| epp_id | INTEGER | FK → epp_catalogo |
| tipo | TEXT | `ingreso`, `egreso`, `devolucion`, `ajuste` |
| cantidad | INTEGER | Positivo o negativo segun tipo |
| referencia_id | INTEGER | ID del documento origen (nullable) |
| referencia_tipo | TEXT | `entrega`, `devolucion`, `ajuste_manual` (nullable) |
| usuario_id | INTEGER | FK → users (quien realizo el movimiento) |
| observaciones | TEXT | nullable |
| created_at | TEXT | — |

#### `solicitud_historial`
Log de cambios de estado de cada solicitud.

| Columna | Tipo | Descripcion |
|---|---|---|
| id | INTEGER | PK |
| solicitud_id | INTEGER | FK → solicitudes_epp |
| estado_anterior | TEXT | — |
| estado_nuevo | TEXT | — |
| usuario_id | INTEGER | FK → users (quien realizo el cambio) |
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
  └─ Registra entrega fisica (estado: entregada)
       ├─ Genera PDF de entrega (trabajador, EPP, fecha, espacio de firma)
       ├─ Descuenta stock y registra en stock_movimientos
       ├─ Actualiza asignaciones_activas
       └─ Email a solicitante con documento adjunto
```

### 5.2 Devolucion

```
Bodega o Administrador
  └─ Registra devolucion
       ├─ Indica estado del EPP devuelto
       ├─ Actualiza asignaciones_activas (reduce o elimina)
       ├─ Si estado = "bueno": suma al stock disponible
       ├─ Registra en stock_movimientos
       └─ Email de confirmacion al trabajador
```

### 5.3 Ingreso a Stock

```
Administrador o Bodega
  └─ Registra ingreso de EPP
       ├─ Selecciona tipo de EPP del catalogo
       ├─ Indica cantidad, lote y proveedor (opcional)
       ├─ Sube certificado tecnico del lote (PDF, opcional)
       ├─ Registra en stock_movimientos (tipo: ingreso)
       └─ Si stock supera minimo: cancela alerta critica activa
```

---

## 6. Funcionalidades Clave

### 6.1 Certificados de EPP

- Bodega puede subir un PDF de certificado tecnico a nivel de catalogo (aplica a todo el tipo de EPP).
- Tambien puede subir un certificado especifico por lote en cada `entrega_item` (`certificado_lote_url`).
- Ambos certificados quedan asociados al documento de entrega.

### 6.2 Documento de Entrega (PDF exportable)

El sistema genera un PDF por entrega con:

- Datos del trabajador (nombre, RUT, cargo si existe)
- Listado de EPP entregado (descripcion, cantidad, lote)
- Fecha de entrega
- Espacio para firma del receptor y del responsable de bodega
- Certificados tecnicos anexados (del tipo y/o del lote)

El documento esta disenado para:

a. Subirse a **Buk** para firma digital electronica.
b. Imprimirse y firmarse en papel.

### 6.3 Documento Firmado

- Una vez obtenida la firma (Buk o papel escaneado), bodega o administrador sube el PDF firmado.
- El archivo queda asociado a `entregas_epp.documento_firmado_url`.
- Visible en la ficha del trabajador y en la vista de documentacion.

### 6.4 Vista de Documentacion (Matriz Trabajador x EPP)

Tabla donde:

- **Filas**: trabajadores activos
- **Columnas**: tipos de EPP configurados como visibles en la matriz
- **Celda**: muestra estado del documento de la ultima entrega (sin documento / pendiente firma / firmado) con acceso de descarga
- **Por fila**: boton para descargar todas las entregas del trabajador en un ZIP o PDF combinado

Permite a administracion verificar de un vistazo que trabajadores tienen EPP al dia y documentacion completa.

### 6.5 Ficha del Trabajador

Vista individual por trabajador con:

- EPP actualmente asignado (asignaciones_activas)
- Historial de todas las entregas
- Historial de devoluciones
- Documentos de entrega generados y firmados, descargables
- Alertas de EPP proximo a vencer

### 6.6 Tipos de EPP Configurables

Desde el modulo de administracion, CRUD completo sobre `epp_catalogo`:

- Crear, editar y desactivar tipos de EPP
- Configurar vida util, stock minimo y unidad de medida
- Subir o reemplazar el certificado tecnico del tipo
- Marcar si el tipo es visible en la vista de documentacion (matriz)

---

## 7. API REST

Todos los endpoints requieren header `Authorization: Bearer <token>` salvo `/auth/login` y `/auth/reset-password`.

Las respuestas usan formato JSON `{ data, error, message }`.

### 7.1 Autenticacion (`/api/auth`)

| Metodo | Ruta | Descripcion | Roles |
|---|---|---|---|
| POST | `/login` | Obtiene JWT | Todos |
| POST | `/logout` | Invalida sesion (cliente) | Autenticado |
| POST | `/reset-request` | Envia email con token de reset | Publico |
| POST | `/reset-password` | Cambia contrasena con token | Publico |
| GET | `/me` | Datos del usuario autenticado | Autenticado |

### 7.2 Usuarios (`/api/users`)

| Metodo | Ruta | Descripcion | Roles |
|---|---|---|---|
| GET | `/` | Lista usuarios | Admin |
| POST | `/` | Crea usuario | Admin |
| GET | `/:id` | Obtiene usuario | Admin, propio |
| PUT | `/:id` | Edita usuario | Admin |
| PATCH | `/:id/toggle-activo` | Activa/desactiva | Admin |

### 7.3 Catalogo EPP (`/api/epp`)

| Metodo | Ruta | Descripcion | Roles |
|---|---|---|---|
| GET | `/` | Lista catalogo | Todos |
| POST | `/` | Crea tipo de EPP | Admin |
| PUT | `/:id` | Edita tipo | Admin |
| DELETE | `/:id` | Desactiva tipo | Admin |
| POST | `/:id/certificado` | Sube PDF certificado tipo | Admin, Bodega |
| GET | `/stock` | Stock actual por tipo | Admin, Bodega |

### 7.4 Solicitudes (`/api/solicitudes`)

| Metodo | Ruta | Descripcion | Roles |
|---|---|---|---|
| GET | `/` | Lista solicitudes (filtrable) | Admin, Autorizador, Bodega |
| POST | `/` | Crea solicitud | Operador |
| GET | `/:id` | Detalle de solicitud | Segun rol |
| PATCH | `/:id/aprobar` | Aprueba | Autorizador, Admin |
| PATCH | `/:id/rechazar` | Rechaza con motivo | Autorizador, Admin |
| GET | `/mias` | Solicitudes del usuario autenticado | Operador |

### 7.5 Entregas (`/api/entregas`)

| Metodo | Ruta | Descripcion | Roles |
|---|---|---|---|
| POST | `/` | Registra entrega | Bodega, Admin |
| GET | `/:id` | Detalle de entrega | Admin, Bodega |
| GET | `/:id/documento` | Descarga PDF generado | Autenticado |
| POST | `/:id/documento-firmado` | Sube PDF firmado | Bodega, Admin |
| GET | `/:id/documento-firmado` | Descarga PDF firmado | Autenticado |
| POST | `/:id/items/:itemId/certificado-lote` | Sube certificado de lote | Bodega, Admin |

### 7.6 Asignaciones (`/api/asignaciones`)

| Metodo | Ruta | Descripcion | Roles |
|---|---|---|---|
| GET | `/` | Todas las asignaciones activas | Admin, Bodega, Consulta |
| GET | `/usuario/:id` | EPP activo de un trabajador | Admin, Bodega, Consulta, propio |

### 7.7 Devoluciones (`/api/devoluciones`)

| Metodo | Ruta | Descripcion | Roles |
|---|---|---|---|
| POST | `/` | Registra devolucion | Bodega, Admin |
| GET | `/` | Lista devoluciones | Admin, Bodega |
| GET | `/:id` | Detalle | Admin, Bodega |

### 7.8 Stock (`/api/stock`)

| Metodo | Ruta | Descripcion | Roles |
|---|---|---|---|
| POST | `/ingreso` | Registra ingreso de EPP | Admin, Bodega |
| GET | `/movimientos` | Historial de movimientos | Admin, Bodega |
| GET | `/movimientos/:epp_id` | Movimientos por tipo | Admin, Bodega |
| GET | `/alertas` | EPP bajo stock minimo | Admin, Bodega |

### 7.9 Reportes (`/api/reports`)

| Metodo | Ruta | Descripcion | Roles |
|---|---|---|---|
| GET | `/matriz` | Datos de matriz trabajador x EPP | Admin, Consulta, Autorizador |
| GET | `/trabajador/:id` | Ficha completa del trabajador | Admin, Consulta |
| GET | `/trabajador/:id/zip` | ZIP de todos los documentos | Admin, Consulta |

---

## 8. Seguridad

| Aspecto | Implementacion |
|---|---|
| Autenticacion | JWT firmado con HS256, expiracion configurable (default 8h) |
| Contrasenas | Hash bcrypt, costo minimo 10 |
| Requisitos de contrasena | Minimo 8 caracteres, al menos 1 mayuscula, 1 numero |
| Validacion RUT | Algoritmo de digito verificador chileno en backend y frontend |
| Reset de contrasena | Token de un solo uso con expiracion de 1 hora |
| Control de acceso | Middleware por rol en cada endpoint |
| Subida de archivos | Solo PDF, tamano maximo 10 MB, nombre aleatorio en servidor |
| Variables sensibles | Solo en variables de entorno, nunca en codigo |

---

## 9. Emails Automaticos

Sistema de notificaciones con Nodemailer. Las plantillas son texto plano con datos dinamicos.

| Evento | Destinatario(s) | Contenido |
|---|---|---|
| Creacion de usuario | Usuario nuevo | Credenciales iniciales y enlace de primer acceso |
| Solicitud enviada | Autorizadores | Datos del solicitante y EPP requerido |
| Solicitud aprobada | Solicitante | Confirmacion, EPP aprobado |
| Solicitud rechazada | Solicitante | Motivo del rechazo |
| Entrega registrada | Solicitante | Confirmacion con PDF de entrega adjunto |
| Stock critico | Administradores, Bodega | Tipo de EPP y stock actual |
| Reset de contrasena | Usuario | Enlace con token (expira 1 hora) |

---

## 10. Despliegue

### 10.1 Plataforma

Railway.app con un unico servicio que sirve backend y frontend compilado.

### 10.2 Variables de Entorno Requeridas

| Variable | Descripcion |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | Puerto del servidor (Railway lo asigna automaticamente) |
| `JWT_SECRET` | Clave secreta para firmar tokens (minimo 32 caracteres) |
| `JWT_EXPIRY` | Expiracion del token (ej. `8h`) |
| `DB_PATH` | Ruta absoluta al archivo SQLite en el volumen persistente |
| `UPLOAD_PATH` | Ruta absoluta al directorio de archivos subidos |
| `SMTP_HOST` | Servidor SMTP |
| `SMTP_PORT` | Puerto SMTP (ej. `587`) |
| `SMTP_USER` | Usuario SMTP |
| `SMTP_PASS` | Contrasena SMTP |
| `EMAIL_FROM` | Direccion remitente (ej. `noreply@hidrotecnica.cl`) |
| `FRONTEND_URL` | URL publica del sistema (para links en emails) |

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
- [ ] Autenticacion JWT (login, logout, reset)
- [ ] CRUD usuarios con validacion RUT
- [ ] CRUD catalogo EPP
- [ ] Flujo solicitud (crear, aprobar, rechazar)
- [ ] Flujo entrega (registrar, generar PDF, descontar stock)
- [ ] Flujo devolucion (registrar, actualizar stock y asignaciones)
- [ ] Ingreso a stock
- [ ] Subida de certificados (tipo y lote)
- [ ] Subida de documento firmado
- [ ] Endpoint matriz trabajador x EPP
- [ ] Endpoint ficha de trabajador + ZIP documentos
- [ ] Alertas de stock critico
- [ ] Emails automaticos (todos los eventos)
- [ ] Middleware de roles

### Frontend
- [ ] Login y recuperacion de contrasena
- [ ] Panel operador: crear solicitud, ver historial propio
- [ ] Panel autorizador: aprobar/rechazar solicitudes
- [ ] Panel bodega: registrar entrega, devolucion, ingreso stock, subir certificados y documentos firmados
- [ ] Panel admin: CRUD usuarios, CRUD catalogo EPP, reportes
- [ ] Vista matriz trabajador x EPP con descarga
- [ ] Ficha de trabajador
- [ ] Alertas de stock critico visibles en dashboard

### Despliegue
- [ ] Variables de entorno configuradas en Railway
- [ ] Volumen persistente montado
- [ ] Build y start validados en produccion
- [ ] Usuario administrador inicial creado

---

*Documento generado por Gerencia General. Revision pendiente antes de inicio de desarrollo.*
