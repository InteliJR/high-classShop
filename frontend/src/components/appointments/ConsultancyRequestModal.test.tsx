// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConsultancyRequestModal from "./ConsultancyRequestModal";

afterEach(cleanup);

describe("ConsultancyRequestModal", () => {
  it.each(["", " \n\t ", "a".repeat(501)])(
    "rejects invalid reason before invoking registration: %p",
    async (reason) => {
      const onSubmit = vi.fn();
      render(
        <ConsultancyRequestModal
          specialistName="Ana Silva"
          onClose={vi.fn()}
          onSubmit={onSubmit}
        />,
      );
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: reason },
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Enviar solicitação" }),
      );
      expect(await screen.findByRole("alert")).toBeTruthy();
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );

  it("accepts the boundary and trims surrounding whitespace", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ConsultancyRequestModal
        specialistName="Ana Silva"
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    const field = screen.getByRole("textbox");
    expect(field.getAttribute("maxlength")).toBe("500");
    fireEvent.change(field, { target: { value: ` ${"a".repeat(500)} ` } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("a".repeat(500)));
  });

  it("prevents duplicate registration and dismissal while the request is in flight", async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn().mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const onClose = vi.fn();
    render(
      <ConsultancyRequestModal
        specialistName="Ana Silva"
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );
    const field = screen.getByRole("textbox");
    fireEvent.change(field, { target: { value: "Meu motivo" } });
    const button = screen.getByRole("button", { name: "Enviar solicitação" });
    fireEvent.click(button);
    fireEvent.submit(button.closest("form")!);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    expect((field as HTMLTextAreaElement).disabled).toBe(true);
    await act(async () => resolve());
  });
});
