import {Modal} from "../modal.tsx";
import {useState} from "react";


function MyComponent() {

    const [size, setSize] = useState(10);
    const [message, setMessage] = useState('firstOne')
    const [id, setId] = useState('one')

    return <>
        <Modal info={{size}}
               list={[{id: 'second', message}]}
               onClick={(e) => {
                   console.log("=>(in.tsx:14) e.count", e.count, size);
               }}
        />
    </>
}



function Input (props: { onChange?: (e: { value: string }) => void }) {
    return <></>
}