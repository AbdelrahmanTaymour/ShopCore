export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
}

export interface Order {
  id: string;
  userId: string;
  status: "PENDING" | "PAID" | "FAILED";
  items: OrderItem[];
  total: number;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}
