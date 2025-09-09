import {forwardRef, memo} from "react";




function MyComp() {

    return <Custom onError={(e) => {
        console.error("Custom onError", e);
    }} />
}


interface CustomProps {
    onError?: (...args: any[]) => any
}

interface CustomAPI {

}


export const Custom = memo(forwardRef<CustomAPI, CustomProps>
(function Custom(props, ref) {

    return <></>
}))

