import {forwardRef, memo} from "react";

type WidthType = 'small' | 'big' | number | { get(): number};
interface DialogProps {
    width?: {get: () => number};
    onClose?: () => void;
}

interface DialogAPI {

}


export const Dialog = memo(forwardRef<DialogAPI, DialogProps>
(function Dialog(props, ref) {

    return <></>
}))


// export { WidthType }

interface TheWrapped {
    primary: WidthType;
}