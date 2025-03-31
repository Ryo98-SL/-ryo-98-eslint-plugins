import {forwardRef, memo} from "react";


export type ModalInfoType =  {size: number } | boolean
interface ModalProps {
    info: ModalInfoType;
}

interface ModalAPI {

}


export const Modal = memo(forwardRef<ModalAPI, ModalProps>
(function Modal(props, ref) {

    return <></>
}))
