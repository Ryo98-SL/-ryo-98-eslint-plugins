import {Modal} from "../../../../share-comps/modal.tsx";
import {useCallback, useMemo, useState} from "react";


function MyComponent() {

    const [size, setSize] = useState(10);
    const [message, setMessage] = useState('firstOne')
    const [id, setId] = useState('one')
    
    
    
    const doYourJob = useCallback(() => {
        console.log("=>(in.tsx:12) hello job", );
    }, []);
    
    const handleYourDuty = (content: string) => {
        console.log(`=>(in.tsx:19) duty ${content}`, );
    }
    
    const onAddToSubjectClick = (targetSubject: string) => {
    
    }
    
    const subjectList = useMemo(()=>{
        return []
    },[])

    
    return <>
        <Modal info={{size}}
               list={[{id: 'second', message}]}
               onClick={(e) => {
                   doYourJob();
                   // handleYourDuty('Man!');
                   // console.log("=>(in.tsx:14) e.count", e.count, size);
               }}
               
        />
        {
            subjectList.map(elem => <Modal onClose={() => {onAddToSubjectClick(elem)}}></Modal>)
        }
    </>
}



function Input (props: { onChange?: (e: { value: string }) => void }) {
    return <></>
}