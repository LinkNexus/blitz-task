function serializeValue(value: any, key: string, form: FormData) {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    let idx = 0;

    for (const item of value) {
      if (item === null || item === undefined) continue;

      const itemKey = `${key}[${idx}]`;
      serializeValue(item, itemKey, form);
      idx++;
    }
  } else if (value instanceof File || value instanceof Blob) {
    form.append(key, value);
  } else if (typeof value === "object") {
    for (const [subKey, subValue] of Object.entries(value)) {
      const propKey = key ? `${key}.${subKey}` : subKey;
      serializeValue(subValue, propKey, form);
    }
  } else {
    form.append(key, String(value));
  }
}

export function aspNetFormSerializer(body: unknown): FormData {
  const form = new FormData();
  serializeValue(body, "", form);

  return form;
}
