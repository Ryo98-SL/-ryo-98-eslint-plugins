import {Dialog} from "../dialog.tsx";
import { useCallback, useMemo, useRef, useState } from "react";


function Dummy() {

    const [count, setCount] = useState(1);
    const numberRef = useRef(0);
    
    const dialogWidth = useMemo<{ get: () => number; } | undefined>(() => { return { get: () => numberRef.current }; }, []);
    
    const dialogOnClose = useCallback<(() => void)>(() => {
        console.log("=>(in.tsx:10) hello");
        setCount(count + 1);
    }, [count]);
    return <div>
        <Dialog width={dialogWidth}
                onClose={dialogOnClose}
        />

    </div>
}
