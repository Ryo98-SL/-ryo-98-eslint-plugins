import { DialogAPI, Dialog } from "./../dialog.tsx";
import { useRef } from "react";


const MyFc = () => {
    const dialogRef = useRef<DialogAPI>(null);
    return <Dialog ref={dialogRef} width={DialogWidth}/>;
}

const genClose = () => {
    return {
        base: () => {},
        getWidth: () => ({get: () => 1})
    }
}
const DialogWidth: { get: () => number; } | undefined = genClose().getWidth();
