import {Dialog} from "../../../../share-comps/dialog.tsx";
import { useCallback, useMemo, useRef, useState } from "react";


function Dummy() {

    const [count, setCount] = useState(1);
    const numberRef = useRef(0);
    
    const dialogWidth = useMemo<Parameters<typeof Dialog>[0]["width"]>(() => { return { get: () => numberRef.current }; }, []);
    
    const handleDialogClose = useCallback<(Parameters<typeof Dialog>[0]["onClose"]) & Function>(() => {
        const obj = {
            value: 1,
        };
        console.log("=>(in.tsx:10) hello", obj.value);
        setCount(count + 1);
    }, [count]);
    return <div>
        <Dialog width={dialogWidth}

                onClose={handleDialogClose}
        />

    </div>
}
