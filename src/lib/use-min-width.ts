"use client";
import { useEffect, useState } from "react";

/**
 * true while the viewport is at least `px` wide (window.matchMedia) — used to switch between the table (laptop /
 * desktop) and the card list (phone / tablet) without depending on responsive CSS display classes.
 */
export function useMinWidth(px: number) {
    const [wide, setWide] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia(`(min-width: ${px}px)`);
        const update = () => setWide(mq.matches);
        update();
        mq.addEventListener?.("change", update);
        window.addEventListener("resize", update);
        return () => { mq.removeEventListener?.("change", update); window.removeEventListener("resize", update); };
    }, [px]);
    return wide;
}