import { DialogAPI, Dialog } from "./../dialog.tsx";
import { useRef } from "react";


const MyFc = () => {
    const dialogRef = useRef<DialogAPI>(null);
    return <Dialog ref={dialogRef}/>;
}