import { useCallback, forwardRef, memo } from "react";




function MyComp() {

    
    const handleCustomError = useCallback<(Parameters<typeof Custom>[0]["onError"]) & Function>((e) => {
        console.error("Custom onError", e);
    }, []);
    return <Custom onError={handleCustomError} />
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

