import { beforeEach } from "vitest";

// happy-dom has no Popover API, so the two methods the card calls stand in for it in every test.
export const popovers = HTMLElement.prototype as unknown as { showPopover?: () => void; hidePopover?: () => void };

beforeEach(() => {
    popovers.showPopover = function (this: HTMLElement) {
        if (this.hasAttribute("data-showing")) {
            throw new Error("The popup is already showing");
        }
        this.setAttribute("data-showing", "");
    };
    popovers.hidePopover = function (this: HTMLElement) {
        if (this.hasAttribute("data-showing")) {
            this.removeAttribute("data-showing");
            this.dispatchEvent(Object.assign(new Event("beforetoggle"), { newState: "closed" }));
        }
    };
});
