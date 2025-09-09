import {Dialog} from "../../../../share-comps/dialog.tsx";
import {useRef, useState} from "react";


function Dummy() {

    const [count, setCount] = useState(1);
    const numberRef = useRef(0);
    return <div>
        <Dialog width={{get: () => numberRef.current}}

                onClose={() => {
                    const obj = {
                        value: 1,
                    };

                    console.log("=>(in.tsx:10) hello", obj.value );
                    setCount(count + 1);
                }}
        />

    </div>
}
