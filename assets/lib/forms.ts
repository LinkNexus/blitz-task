import type { FormErrors } from "@/types";

function setFormErrors(form: any, errors: FormErrors) {
  errors.violations.forEach((v) => {
    form.setError(v.propertyPath, {
      message: v.title,
    });
  });
}

export { setFormErrors };
