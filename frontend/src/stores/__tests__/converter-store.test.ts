import { describe, it, expect, beforeEach } from "vitest";
import { useConverterStore } from "../converter-store";

describe("converter-store", () => {
  beforeEach(() => {
    useConverterStore.getState().reset();
  });

  describe("step management", () => {
    it("starts at step 0", () => {
      expect(useConverterStore.getState().step).toBe(0);
    });

    it("can set step", () => {
      useConverterStore.getState().setStep(3);
      expect(useConverterStore.getState().step).toBe(3);
    });

    it("supports step 5 (coding)", () => {
      useConverterStore.getState().setStep(5);
      expect(useConverterStore.getState().step).toBe(5);
    });
  });

  describe("coding config management", () => {
    it("starts with empty coding config", () => {
      const { codingConfig } = useConverterStore.getState();
      expect(codingConfig.innerAxes).toEqual([]);
      expect(codingConfig.outerAxes).toEqual([]);
      expect(codingConfig.texts).toEqual([]);
    });

    it("adds inner axis with auto-label", () => {
      useConverterStore.getState().addInnerAxis(100, "");
      const { codingConfig } = useConverterStore.getState();
      expect(codingConfig.innerAxes).toHaveLength(1);
      expect(codingConfig.innerAxes[0].x).toBe(100);
      expect(codingConfig.innerAxes[0].label).toBe("A");
    });

    it("auto-labels sequentially (A, B, C...)", () => {
      const store = useConverterStore.getState();
      store.addInnerAxis(100, "");
      store.addInnerAxis(200, "");
      store.addInnerAxis(300, "");
      const { codingConfig } = useConverterStore.getState();
      expect(codingConfig.innerAxes.map(a => a.label)).toEqual(["A", "B", "C"]);
    });

    it("respects custom label", () => {
      useConverterStore.getState().addInnerAxis(100, "X");
      const { codingConfig } = useConverterStore.getState();
      expect(codingConfig.innerAxes[0].label).toBe("X");
    });

    it("enforces max 30 inner axes", () => {
      const store = useConverterStore.getState();
      for (let i = 0; i < 35; i++) {
        store.addInnerAxis(i * 10, "");
      }
      expect(useConverterStore.getState().codingConfig.innerAxes).toHaveLength(30);
    });

    it("removes inner axis", () => {
      const store = useConverterStore.getState();
      store.addInnerAxis(100, "A");
      store.addInnerAxis(200, "B");
      store.removeInnerAxis(0);
      const { codingConfig } = useConverterStore.getState();
      expect(codingConfig.innerAxes).toHaveLength(1);
      expect(codingConfig.innerAxes[0].label).toBe("B");
    });

    it("updates inner axis label", () => {
      const store = useConverterStore.getState();
      store.addInnerAxis(100, "A");
      store.updateInnerAxisLabel(0, "X1");
      expect(useConverterStore.getState().codingConfig.innerAxes[0].label).toBe("X1");
    });

    it("adds outer axis with auto-label", () => {
      useConverterStore.getState().addOuterAxis(200, "");
      const { codingConfig } = useConverterStore.getState();
      expect(codingConfig.outerAxes).toHaveLength(1);
      expect(codingConfig.outerAxes[0].label).toBe("1");
    });

    it("enforces max 10 outer axes", () => {
      const store = useConverterStore.getState();
      for (let i = 0; i < 15; i++) {
        store.addOuterAxis(i * 50, "");
      }
      expect(useConverterStore.getState().codingConfig.outerAxes).toHaveLength(10);
    });

    it("adds text annotation", () => {
      useConverterStore.getState().addText(100, 200, "2.40m");
      const { codingConfig } = useConverterStore.getState();
      expect(codingConfig.texts).toHaveLength(1);
      expect(codingConfig.texts[0]).toEqual({ x: 100, y: 200, value: "2.40m", fontSize: 12 });
    });

    it("removes text", () => {
      const store = useConverterStore.getState();
      store.addText(100, 200, "text1");
      store.addText(300, 400, "text2");
      store.removeText(0);
      expect(useConverterStore.getState().codingConfig.texts).toHaveLength(1);
      expect(useConverterStore.getState().codingConfig.texts[0].value).toBe("text2");
    });

    it("updates text", () => {
      const store = useConverterStore.getState();
      store.addText(100, 200, "old");
      store.updateText(0, { value: "new", fontSize: 16 });
      const text = useConverterStore.getState().codingConfig.texts[0];
      expect(text.value).toBe("new");
      expect(text.fontSize).toBe(16);
    });
  });

  describe("coding mode", () => {
    it("starts with null coding mode", () => {
      expect(useConverterStore.getState().codingMode).toBeNull();
    });

    it("can set coding mode", () => {
      useConverterStore.getState().setCodingMode("manual");
      expect(useConverterStore.getState().codingMode).toBe("manual");
    });

    it("can set coding tool", () => {
      useConverterStore.getState().setCodingTool("innerAxis");
      expect(useConverterStore.getState().codingTool).toBe("innerAxis");
    });
  });

  describe("reset", () => {
    it("resets all state including coding", () => {
      const store = useConverterStore.getState();
      store.setStep(5);
      store.setCodingMode("manual");
      store.addInnerAxis(100, "A");
      store.addText(50, 50, "test");

      store.reset();

      const state = useConverterStore.getState();
      expect(state.step).toBe(0);
      expect(state.codingMode).toBeNull();
      expect(state.codingConfig.innerAxes).toEqual([]);
      expect(state.codingConfig.texts).toEqual([]);
    });
  });

  describe("result with imageHeight", () => {
    it("stores imageHeight from result", () => {
      useConverterStore.getState().setResult("http://dxf", "http://preview", 800);
      expect(useConverterStore.getState().resultImageHeight).toBe(800);
    });

    it("defaults imageHeight to null", () => {
      useConverterStore.getState().setResult("http://dxf", "http://preview");
      expect(useConverterStore.getState().resultImageHeight).toBeNull();
    });
  });
});
