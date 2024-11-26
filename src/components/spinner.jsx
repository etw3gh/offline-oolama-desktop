'use client'
import { Fragment } from 'react'
import '../App.css'

export default function Spinner({text}) {
  return (
    <Fragment>
      <span className="loader" />
      <span>
        {text}
      </span>
    </Fragment>
  )
}
