interface User {
  id: number;
  name: string;
  email: string;
  isVerified: boolean;
}

export interface FormErrors {
  violations: {
    propertyPath: string;
    title: string;
  }[];
}

export type { User };
