import ListDataArrayAlias, { OnClickType, ModalInfoType, Modal } from "./../modal.tsx";
import { useCallback, useMemo, useState } from "react";


function MyComponent() {

    const [size, setSize] = useState(10);
    const [message, setMessage] = useState('firstOne')
    const [id, setId] = useState('one')

    
    const modalInfo = useMemo<ModalInfoType | undefined>(() => { return { size }; }, [size]);
    
    const modalList = useMemo<ListDataArrayAlias | undefined>(() => { return [{ id: 'second', message }]; }, [message]);
    
    const modalOnClick = useCallback<OnClickType>((e) => {
        console.log("=>(in.tsx:14) e.count", e.count, size);
    }, [size]);
    return <>
        <Modal info={modalInfo}
               list={modalList}
               onClick={modalOnClick}
        />
    </>
}



function Input (props: { onChange?: (e: { value: string }) => void }) {
    return <></>
}