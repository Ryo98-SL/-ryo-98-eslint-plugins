import {Dialog} from "../dialog.tsx";
import {useRef, useState} from "react";


function Dummy() {

    const [count, setCount] = useState(1);
    const numberRef = useRef(0);
    return <div>
        <Dialog width={{get: () => numberRef.current}}
                onClose={() => {
                    console.log("=>(in.tsx:10) hello", );
                    setCount(count + 1);
                }}
        />

    </div>
}
