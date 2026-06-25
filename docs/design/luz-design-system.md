# CCEM UC — Sistema de diseño «Luz»

> Dirección visual aprobada para el sitio del **II° Congreso de Cirugía UC para Estudiantes
> de Medicina**. Esta es la fuente de verdad del diseño: paleta, tipografía, tokens,
> componentes y voz. Todo cambio de UI deriva de este documento.

**Carácter:** clínico, preciso, sereno. Mínimo y aireado — el espacio en blanco hace casi
todo el trabajo. Una sola idea memorable: la **incisión** (una hairline con una marca roja),
que reemplaza a los `<hr>` repetidos y al calendario vacío.

---

## 1. Paleta

El mundo del quirófano: el verde de los campos quirúrgicos sobre el blanco estéril, el acero
del instrumental, y el rojo de la incisión como único acento.

| Token            | Hex       | Uso |
|------------------|-----------|-----|
| Campo estéril    | `#F4F7F6` | Fondo de página (`background`) |
| Blanco estéril   | `#FFFFFF` | Tarjetas y superficies elevadas (`card`) |
| Verde quirúrgico | `#0F6E6E` | Color primario: CTAs, enlaces, marca (`primary`) |
| Verde hover      | `#0C5A57` | Estado hover del primario |
| Quirófano profundo | `#0A3B3B` | Texto principal (`foreground`), títulos |
| Texto secundario | `#5D716E` | Párrafos secundarios, metadatos (`muted-foreground`) |
| Acero            | `#9AA8A6` | Íconos tenues, texto deshabilitado |
| Borde / hairline | `#E1EAE8` | Líneas finas, bordes de tarjeta (`border`) |
| Menta            | `#E3F1ED` | Fondos sutiles de realce (`secondary` / `accent`) |
| Incisión         | `#E2483D` | Acento único: la marca de la incisión, foco destructivo. **Uso mínimo.** |

**Regla del acento:** el rojo «Incisión» nunca cubre superficies grandes ni se usa para CTAs.
Solo aparece como la marca (◆) al final de la línea de incisión y en estados destructivos.

### Rampa primaria (teal)

Reemplaza la rampa azul `--color-primary-*` anterior. `/confirmation` y `/error` usan
`bg-primary-700`, por lo que al redefinir la rampa esas páginas se reestilan solas.

```
50 #ECF6F5 · 100 #CFEAE7 · 200 #A3D5D0 · 300 #6FBAB4 · 400 #3E9A94
500 #1C807A · 600 #0F6E6E · 700 #0C5A57 · 800 #0A3B3B · 900 #073030 · 950 #052424
```

---

## 2. Tipografía

Tres familias, cada una con un rol claro. Se cargan con `next/font/google` (sin `@import` en CSS).

| Rol     | Familia        | Pesos      | Uso |
|---------|----------------|------------|-----|
| Display | **Space Grotesk** | 500/600/700 | Hero, títulos de sección, títulos de tarjeta. Ajustado, técnico. `--font-space-grotesk` |
| Cuerpo  | **Inter**         | 400/500/600 | Párrafos, navegación, formularios. Humanista, legible. `--font-inter` |
| Dato    | **Space Mono**    | 400/700     | Eyebrows, fechas, cupos, precios, etiquetas tipo ficha. `--font-space-mono` |

### Escala

| Elemento        | Tamaño | Familia | Notas |
|-----------------|--------|---------|-------|
| Hero            | `clamp(36px, 6vw, 72px)` | Display 600 | `letter-spacing: -0.03em`, `line-height: 1.02` |
| Título sección  | `clamp(28px, 4vw, 40px)` | Display 600 | `letter-spacing: -0.02em` |
| Título tarjeta  | `20–24px` | Display 600 | |
| Cuerpo          | `16–19px` | Inter 400 | `line-height: 1.6` |
| Eyebrow / label | `12px`   | Mono 400 | `text-transform: uppercase`, `letter-spacing: .18em`, color primario |
| Dato (fecha/cupo/precio) | `13–24px` | Mono | color primario para valores |

Toda copy se mantiene en **español**.

---

## 3. Layout y espaciado

- **Ancho máximo de contenido:** `max-w-6xl` (72rem) para texto; `max-w-7xl` para grillas de tarjetas.
- **Padding de página:** `px-6` móvil, `px-8`+ desktop. Secciones con `py-16` a `py-24` — generoso.
- **Aire:** preferir más espacio en blanco que menos. El hero respira (`py-24`+).
- **Bordes:** hairlines de 1px en `--border`. Radios vía shadcn (`--radius: 0.625rem`): tarjetas `rounded-xl`, botones/inputs `rounded-lg`.
- **Sombras:** mínimas. Tarjetas planas con borde hairline; sombra suave solo en superficies flotantes (popovers, menú móvil).

---

## 4. Elementos de firma

### Incisión (`IncisionDivider`)
Una línea de 2px en verde quirúrgico con una marca (◆ rotada 45°) en rojo «Incisión» al final.
Reemplaza **todos** los `<hr className="border-t-2 border-gray-300" />` y el calendario vacío.
En carga se traza con `scaleX` (origen izquierda), respetando `prefers-reduced-motion`.

### Encabezado de sección (`SectionHeading`)
Reemplaza el patrón repetido `text-3xl font-bold text-[#00778B]` + `<hr>`. Compone:
- **eyebrow** opcional (mono, uppercase, primario),
- **título** (Space Grotesk), centrado o a la izquierda,
- **IncisionDivider** debajo.

### Etiquetas mono tipo ficha
Fechas, cupos, precios y números de módulo se muestran en Space Mono — sensación de ficha clínica.

---

## 5. Componentes (shadcn/ui + lucide)

Se adopta **shadcn/ui** (estilo `new-york`, Tailwind v4, RSC) e íconos **lucide-react**.
Componentes en `src/components/ui/`. Helper `cn()` en `src/lib/utils.ts`.

| Componente shadcn | Uso en el sitio |
|-------------------|-----------------|
| `button`   | CTAs (`Sé parte del congreso`, `Inscribir y pagar`), botones fantasma |
| `card`     | Tarjetas de módulo, pases, documentos, resumen de compra |
| `input` / `label` | Formulario de inscripción |
| `select`   | Universidad y año de carrera |
| `table`    | Tabla de fechas importantes (`/about`) |
| `separator`| Separadores neutros donde no aplica la incisión |
| `badge`    | Estados: `cupos disponibles`, `Seleccionado`, semana del módulo |

Variantes de botón: `default` (verde quirúrgico, texto blanco), `outline` (borde acero, texto profundo — el «ghost» del hero), `secondary` (menta). Foco visible con `ring` primario.

### Íconos lucide (selección)
`Menu`, `X` (nav móvil) · `ArrowRight` (CTAs/enlaces) · `Calendar`, `MapPin`, `Clock` (cronograma/módulos) · `Mail`, `Instagram` (contacto) · `FileText`, `Download` (documentos) · `CheckCircle2` (seleccionado/confirmación) · `Users` (cupos).

---

## 6. Motion

Discreto y con propósito. Solo bajo `@media (prefers-reduced-motion: no-preference)`:
- La **incisión** se traza al entrar (`scaleX` 1s, la marca aparece al final).
- Transiciones de hover suaves (≤200ms) en botones, tarjetas y enlaces.
- Sin animaciones ambientales ni parallax — contradicen el carácter sereno.

---

## 7. Accesibilidad (piso de calidad)

- Responsive hasta móvil (la nav colapsa a un menú con `Menu`/`X`).
- Foco de teclado visible (`ring` primario) en todo control interactivo.
- Contraste: texto `#0A3B3B` sobre `#F4F7F6`/`#FFFFFF` supera AA; el verde primario sobre blanco se usa para texto ≥ tamaño cuerpo en negrita o como fondo de botón con texto blanco.
- `prefers-reduced-motion` respetado.

---

## 8. Voz y copy

Activa, en sentence case, español, sin relleno. Una acción mantiene su nombre en todo el flujo
(el botón «Inscribir y pagar» lleva a un estado coherente). Errores claros que dicen qué pasó y
cómo seguir. Etiquetas por lo que la persona reconoce («Cupos disponibles», no «capacity»).

---

## 9. Mapa de tokens shadcn

| shadcn var            | Valor Luz |
|-----------------------|-----------|
| `--background`        | `#F4F7F6` |
| `--foreground`        | `#0A3B3B` |
| `--card`              | `#FFFFFF` |
| `--card-foreground`   | `#0A3B3B` |
| `--primary`           | `#0F6E6E` |
| `--primary-foreground`| `#FFFFFF` |
| `--secondary`         | `#E3F1ED` |
| `--secondary-foreground` | `#0A3B3B` |
| `--muted`             | `#ECF1F0` |
| `--muted-foreground`  | `#5D716E` |
| `--accent`            | `#E3F1ED` |
| `--accent-foreground` | `#0A3B3B` |
| `--destructive`       | `#E2483D` |
| `--border`            | `#E1EAE8` |
| `--input`             | `#D7E2E0` |
| `--ring`              | `#0F6E6E` |
| `--radius`            | `0.625rem` |

Referencia viva de la dirección: `/desing` (variación **01 · Luz**).
