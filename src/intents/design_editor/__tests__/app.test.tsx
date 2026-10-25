import { useFeatureSupport, useSelection } from "@canva/app-hooks";
import { addElementAtCursor, addElementAtPoint } from "@canva/design";
import type { Feature } from "@canva/platform";
import { screen } from "@testing-library/react";
import { App } from "src/intents/design_editor/app";
import { renderInTestProvider } from "src/utils/test_render";

jest.mock("@canva/app-hooks");

describe("SheetSync App Tests", () => {
  const mockIsSupported = jest.fn();
  const mockUseFeatureSupport = jest.mocked(useFeatureSupport);
  const mockUseSelection = jest.mocked(useSelection);

  beforeEach(() => {
    jest.resetAllMocks();
    mockIsSupported.mockImplementation(
      (fn: Feature) => fn === addElementAtPoint,
    );
    mockUseFeatureSupport.mockReturnValue(mockIsSupported);
    mockUseSelection.mockReturnValue({
      count: 0,
      read: jest.fn().mockResolvedValue({ contents: [], save: jest.fn() }),
    } as any);
  });

  it("should render clean initial state prompting to connect user spreadsheet", () => {
    renderInTestProvider(<App />);

    expect(screen.getByText("SheetFlow")).toBeDefined();
    expect(screen.getByText("Connect your spreadsheet to start:")).toBeDefined();
    expect(screen.getByText("Connect Google Sheet")).toBeDefined();
  });

  it("should render Google Sheets URL input field", () => {
    renderInTestProvider(<App />);

    expect(screen.getByText("Google Sheets Sharing URL")).toBeDefined();
  });
});
