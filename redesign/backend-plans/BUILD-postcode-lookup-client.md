# Backend Plan: Postcode Lookup — Client-Side Auto-fill

**Zone:** 1 (pure frontend logic, no server changes, no API key, no env vars)
**Priority:** Non-blocking — booking-new Phase 6 session implements this; form degrades to manual entry if fetch fails
**Depended on by:** booking-new (Step 3 location auto-fill)
**Depends on:** None

---

## 1. Problem

The booking-new form's Step 3 (Location) currently requires the coordinator to manually type city and area. These fields are required for the availability check and city-validation gate. On mobile (the primary device context) manual entry is slow and error-prone. Postcodes.io provides a free, no-key UK postcode API that returns the town and district from a postcode.

---

## 2. Scope of change

**Frontend only.** No new server actions, no new DB columns, no env vars, no API key.

### 2a. `ManualBookingForm.tsx` — postcode blur handler

Add a `handlePostcodeBlur` function called on the postcode input's `onBlur` event:

```typescript
async function handlePostcodeBlur() {
  const raw = postcode.trim().replace(/\s/g, "").toUpperCase();
  if (raw.length < 5) return; // too short to be valid
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${raw}`);
    if (!res.ok) {
      setPostcodeLookupError("Postcode not found. Fill in city and area manually.");
      return;
    }
    const data = await res.json();
    // Only auto-fill if the field is currently empty — never overwrite what the user typed
    if (!city.trim()) setCity(data.result.post_town ?? "");
    if (!area.trim()) setArea(data.result.admin_district ?? "");
    setPostcodeLookupError("");
  } catch {
    setPostcodeLookupError("Couldn't check postcode. Fill in city and area manually.");
  }
}
```

**New state:**
```typescript
const [postcodeLookupError, setPostcodeLookupError] = useState("");
```

**Guard — only auto-fill empty fields:** If the coordinator has already typed a city, the auto-fill does not overwrite it. This prevents the lookup from clobbering manually-entered values when the coordinator later edits the postcode.

**City validation trigger:** After auto-fill, if the new city value is not in the `allowed_cities` list, show the inline "We don't currently serve [city]" error immediately (same as the existing city validation in `handleContinue`).

### 2b. Field order in Step 3 Location panel

New field rendering order:
1. **Postcode** `*` — first field, with `onBlur={handlePostcodeBlur}`
2. **City** `*` — auto-filled, editable
3. **Area** — auto-filled, editable
4. **Address** `*` — free text (postcodes.io does not return individual street addresses)
5. **Access notes** (optional)
6. **Parking notes** (optional)

---

## 3. API contract

```
GET https://api.postcodes.io/postcodes/{postcode}
```

**No authentication required.**

Response shape (success):
```json
{
  "status": 200,
  "result": {
    "postcode": "LU1 1AA",
    "post_town": "LUTON",
    "admin_district": "Luton",
    "admin_ward": "Bury Park",
    "region": "East of England",
    ...
  }
}
```

**Field mapping:**
| postcodes.io field | Form field | Notes |
|---|---|---|
| `result.post_town` | City | Uppercase — normalise to title-case before setting: `toTitleCase(result.post_town)` |
| ~~`result.admin_district`~~ | ~~Area~~ | **Not used** — `admin_district` returns borough/council names that don't match real area names used by the business (e.g. returns "Luton" instead of "Bury Park"). Area field remains manual-entry only. |

**Error cases:**
- 404 response → "Postcode not found. Fill in city and area manually."
- Network failure (catch) → "Couldn't check postcode. Fill in city and area manually."
- `city` not in allowed_cities after fill → existing inline validation fires: "We don't currently serve [city]. Update Allowed cities in Settings."

---

## 4. Fallback behaviour

If postcodes.io is unreachable or returns an error, the form remains fully functional. The coordinator fills city and area manually. The postcode field itself is still required for the booking record — the lookup is an enhancement, not a gate.

---

## 5. No server changes

This plan requires zero backend modifications:
- No new Supabase table columns
- No new server actions
- No new API routes
- No env vars or secrets

The fetch is client-side (`"use client"` component) and goes directly to the public postcodes.io API.

---

## 6. Testing

- Valid UK postcode (e.g. LU1 1AA) → city and area auto-fill correctly
- Invalid postcode → inline error, fields editable
- Network offline → inline error, fields editable
- Pre-filled fields not overwritten when coordinator already has values
- City auto-filled but not in allowed_cities → city validation error shown immediately

---

## 7. Future: client-new form

The same pattern should be applied to the client-new form's postcode input for consistency. That is out of scope for the booking-new session but noted here as a candidate for the client-new Phase 6 session.

---

## 8. Status

`[ ]` Not started
