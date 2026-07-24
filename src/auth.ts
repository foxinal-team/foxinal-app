const defaultUsername = import.meta.env.VITE_DEFAULT_USERNAME ?? "admin";
const defaultPassword = import.meta.env.VITE_DEFAULT_PASSWORD ?? "admin";

export function credentialsMatch(username: string, password: string): boolean {
  return (
    username.trim() === defaultUsername && password === defaultPassword
  );
}
