export const todayYMD = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const newPublicId = () =>
  crypto.randomUUID().replace(/-/g, "").slice(0, 12);
