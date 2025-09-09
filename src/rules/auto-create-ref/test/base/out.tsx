import { DialogAPI, Dialog } from "./../../../../share-comps/dialog.tsx";
import { useRef } from "react";


const MyFc = () => {
    const dialogRef = useRef<DialogAPI>(null);
    return <Dialog ref={dialogRef} width={genClose().getWidth()}/>;
}

const genClose = () => {
    return {
        base: () => {},
        getWidth: () => ({get: () => 1})
    }
}