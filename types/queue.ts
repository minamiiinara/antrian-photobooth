export type Service = "A" | "B" | "C";

export type Booth = {
  id: string;
  store_id: string;
  name: string;
  service: Service; // kolom baru di booths
};
