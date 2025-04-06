import {forwardRef, memo} from "react";


export interface ModalInfoType  {size: number };
export type OnClickType = (e: { count: number }) => void;
export interface ListData {
    id: string;
    message: string;
}

type ListDataArrayAlias = ListData[];

export default ListDataArrayAlias;

interface ModalProps {
    info?: ModalInfoType;
    list?: ListDataArrayAlias;
    onClick?: OnClickType;

    pattern?: RegExp;
}

interface ModalAPI {

}


export const Modal = memo(forwardRef<ModalAPI, ModalProps>
(function Modal(props, ref) {

    return <></>
}))
