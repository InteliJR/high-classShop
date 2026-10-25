// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductDetails from "./ProductDetails";
import ProductCard from "./ProductCard";
import type { Product, UserProps } from "../../types/types";
import { canManageProductImages } from "../../lib/product-images";

const auth = vi.hoisted(() => ({ user: null as Pick<UserProps, "id" | "role"> | null }));
vi.mock("../../store/authStateManager", () => ({ useAuth: () => auth }));

const product: Product = {
  id: "car-1", marca: "Porsche", modelo: "911 GTS", valor: 1500000, currency: "BRL",
  specialist_id: "owner",
  images: [
    { id: 1, image_url: "/second.png", is_primary: false },
    { id: 2, image_url: "/primary.png", is_primary: true },
    { id: 3, image_url: "/third.png", is_primary: false },
  ],
};

afterEach(cleanup);
beforeEach(() => { auth.user = null; });
const mainImages = (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLImageElement>(".image-gallery-image"));

describe("Product gallery", () => {
  it.each(["car", "boat", "aircraft"])("opens the %s with its primary photo and preserves the other photos' order", (kind) => {
    const { container } = render(<ProductDetails product={{ ...product, id: kind }} />);
    expect(mainImages(container).map((image) => image.getAttribute("src")))
      .toEqual(["/primary.png", "/second.png", "/third.png"]);
  });

  it("hides a broken main photo and its thumbnail from visitors, keeping the remaining photos navigable", async () => {
    const { container } = render(<ProductDetails product={product} />);
    fireEvent.error(mainImages(container)[0]);
    expect(mainImages(container).map((image) => image.getAttribute("src"))).toEqual(["/second.png", "/third.png"]);
    expect(container.querySelector('img[src="/primary.png"]')).toBeNull();
    expect(screen.queryByText("Imagem indisponível")).toBeNull();
    fireEvent.click(screen.getByAltText("Miniatura da foto 2"));
    await waitFor(() => expect(container.querySelector(".image-gallery-center img")?.getAttribute("src")).toBe("/third.png"));
  });

  it("shows an empty state when every photo fails", () => {
    const { container } = render(<ProductDetails product={{ ...product, images: [product.images![1]] }} />);
    fireEvent.error(mainImages(container)[0]);
    expect(screen.getByText("Sem fotos disponíveis")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows the failed slot to the owner without removing other photos", () => {
    const { container } = render(<ProductDetails product={product} showImageErrors />);
    fireEvent.error(mainImages(container)[0]);
    expect(screen.getAllByRole("img", { name: "Imagem indisponível" })).toHaveLength(2);
    expect(mainImages(container).map((image) => image.getAttribute("src"))).toEqual(["/second.png", "/third.png"]);
    expect(container.querySelectorAll(".image-gallery-thumbnail")).toHaveLength(3);
  });

  it("hides a photo when its thumbnail fails and retries a refreshed signed URL", () => {
    const { container, rerender } = render(<ProductDetails product={product} />);
    fireEvent.error(screen.getByAltText("Miniatura da foto 1"));
    expect(container.querySelector('img[src="/primary.png"]')).toBeNull();
    rerender(<ProductDetails product={{ ...product, images: product.images!.map((image) =>
      image.is_primary ? { ...image, image_url: "/primary.png?new-signature" } : image) }} />);
    expect(mainImages(container)[0].getAttribute("src")).toBe("/primary.png?new-signature");
  });

  it("uses the legacy photo when the images array is empty", () => {
    const { container } = render(<ProductDetails product={{ ...product, images: [], imageUrl: "/legacy.png" }} />);
    expect(mainImages(container)[0].getAttribute("src")).toBe("/legacy.png");
  });
});

describe("Catalog photo", () => {
  it("replaces a broken primary photo with the next available photo for a visitor", () => {
    render(<ProductCard {...product} />);
    fireEvent.error(screen.getByAltText("Imagem do produto Porsche 911 GTS"));
    expect(screen.getByAltText("Imagem do produto Porsche 911 GTS").getAttribute("src")).toBe("/second.png");
    expect(screen.queryByText("Imagem indisponível")).toBeNull();
  });

  it.each(["ADMIN", "SPECIALIST"] as const)("shows the failed primary photo to the %s responsible for the listing", (role) => {
    auth.user = { id: "owner", role };
    render(<ProductCard {...product} />);
    fireEvent.error(screen.getByAltText("Imagem do produto Porsche 911 GTS"));
    expect(screen.getByText("Imagem indisponível")).toBeTruthy();
  });

  it.each([null, { id: "other", role: "SPECIALIST" }, { id: "owner", role: "CUSTOMER" }] as const)(
    "does not expose image errors to an unrelated viewer: %j", (user) => {
      expect(canManageProductImages(product, user)).toBe(false);
    },
  );
});
